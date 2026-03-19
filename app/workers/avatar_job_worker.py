from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.config import settings
from app.database import video_jobs_collection, videos_collection
from app.models import DirectVideoRequest, VideoRecord
from app.services.s3_service import S3Service
from app.services.sqs_service import SQSService
from app.services.video_service import VideoService

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')


def _to_mongo_safe(value: object) -> object:
    if isinstance(value, BaseModel):
        return {
            key: _to_mongo_safe(item)
            for key, item in value.model_dump(mode='python').items()
        }
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {
            key: _to_mongo_safe(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_to_mongo_safe(item) for item in value]
    return value


def _extract_receive_count(message: dict[str, Any]) -> int:
    attributes = message.get('Attributes')
    if not isinstance(attributes, dict):
        return 1
    raw_count = attributes.get('ApproximateReceiveCount')
    try:
        parsed = int(str(raw_count))
    except (TypeError, ValueError):
        return 1
    return max(1, parsed)


def _parse_job_id(message: dict[str, Any]) -> str | None:
    body = message.get('Body')
    if isinstance(body, dict):
        candidate = body.get('job_id')
        return str(candidate).strip() if candidate else None
    if isinstance(body, str):
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return None
        if isinstance(payload, dict) and payload.get('job_id'):
            return str(payload.get('job_id')).strip() or None
    return None


class AvatarJobWorker:
    def __init__(
        self,
        *,
        sqs_service: SQSService | None = None,
        video_service: VideoService | None = None,
        s3_service: S3Service | None = None,
        jobs_collection: Any = video_jobs_collection,
        videos_collection_ref: Any = videos_collection,
        max_receive_count: int | None = None,
    ) -> None:
        self.sqs_service = sqs_service or SQSService()
        self.video_service = video_service or VideoService()
        self.s3_service = s3_service or S3Service()
        self.jobs_collection = jobs_collection
        self.videos_collection_ref = videos_collection_ref
        self.max_receive_count = max(1, int(max_receive_count or settings.sqs_max_receive_count))

    async def run_forever(self) -> None:
        if not self.sqs_service.is_configured():
            logger.error("SQS not setup")
            raise RuntimeError('SQS queue is not configured. Set SQS_QUEUE_URL before starting the worker.')


        while True:
            logger.info('Avatar job worker started. Polling queue...')
            try:
                messages = await asyncio.to_thread(self.sqs_service.receive_jobs, 5)
            except Exception:
                logger.exception('Failed while polling SQS. Retrying shortly.')
                await asyncio.sleep(2)
                continue

            if not messages:
                continue

            for message in messages:
                try:
                    await self.process_message(message)
                except Exception:
                    logger.exception('Unhandled exception while processing SQS message.')

    async def process_message(self, message: dict[str, Any]) -> None:
        receipt_handle = str(message.get('ReceiptHandle') or '').strip()
        job_id = _parse_job_id(message)
        if not job_id:
            logger.warning('Discarding SQS message without valid job_id: %s', message.get('MessageId'))
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle)
            return

        job = await self.jobs_collection.find_one({'job_id': job_id})
        if not job:
            logger.warning('Job %s not found. Removing SQS message.', job_id)
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle)
            return

        current_status = str(job.get('status') or 'queued').strip().lower()
        if current_status in {'processing', 'completed', 'failed'}:
            logger.info('Job %s already in terminal/in-flight state (%s); deleting duplicate message.', job_id, current_status)
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle)
            return

        started_at = datetime.utcnow()
        claim_result = await self.jobs_collection.update_one(
            {'job_id': job_id, 'status': 'queued'},
            {'$set': {
                'status': 'processing',
                'updated_at': started_at,
                'started_at': started_at,
                'error': None,
            }, '$inc': {'attempts': 1}},
        )
        modified_count = int(getattr(claim_result, 'modified_count', 0))
        if modified_count == 0:
            logger.info('Job %s was claimed by another worker. Deleting duplicate message.', job_id)
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle)
            return

        claimed_job = await self.jobs_collection.find_one({'job_id': job_id})
        user_email = str(claimed_job.get('user_email') or '').strip() if isinstance(claimed_job, dict) else ''
        request_payload = claimed_job.get('request_payload') if isinstance(claimed_job, dict) else {}
        if not isinstance(request_payload, dict):
            request_payload = {}
        if user_email:
            await self.videos_collection_ref.update_one(
                {'video_id': job_id, 'user_email': user_email},
                {'$set': {
                    'status': 'processing',
                    'job_data': {
                        'job_id': job_id,
                        'request_mode': 'avatar',
                        'status': 'processing',
                    },
                }},
            )

        try:
            request = DirectVideoRequest.model_validate(request_payload)
            result = await asyncio.to_thread(lambda: self.video_service.generate_direct(request, wait=True))

            if result.saved_to:
                s3_url = await asyncio.to_thread(
                    self.s3_service.upload_video,
                    result.saved_to,
                    f'videos/direct_{result.video_id}.mp4',
                )
                if s3_url:
                    result.video_url = s3_url

            completed_at = datetime.utcnow()
            await self.jobs_collection.update_one(
                {'job_id': job_id},
                {'$set': {
                    'status': 'completed',
                    'result_payload': _to_mongo_safe(result),
                    'error': None,
                    'updated_at': completed_at,
                    'completed_at': completed_at,
                }},
            )

            if user_email:
                await self._upsert_video_record(user_email, job_id, request, result)

            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle)
            logger.info('Job %s completed successfully.', job_id)
        except Exception as exc:
            receive_count = _extract_receive_count(message)
            failed_at = datetime.utcnow()
            error_message = str(exc).strip() or 'Unknown avatar generation error.'
            logger.exception('Job %s failed on receive count %s.', job_id, receive_count)

            if receive_count >= self.max_receive_count:
                await self.jobs_collection.update_one(
                    {'job_id': job_id},
                    {'$set': {
                        'status': 'failed',
                        'error': error_message,
                        'updated_at': failed_at,
                        'completed_at': failed_at,
                    }},
                )
                if user_email:
                    await self.videos_collection_ref.update_one(
                        {'video_id': job_id, 'user_email': user_email},
                        {'$set': {
                            'status': 'failed',
                            'job_data': {
                                'job_id': job_id,
                                'request_mode': 'avatar',
                                'status': 'failed',
                                'error': error_message,
                            },
                        }},
                    )
                if receipt_handle:
                    await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle)
                return

            await self.jobs_collection.update_one(
                {'job_id': job_id},
                {'$set': {
                    'status': 'queued',
                    'error': error_message,
                    'updated_at': failed_at,
                }},
            )
            if user_email:
                await self.videos_collection_ref.update_one(
                    {'video_id': job_id, 'user_email': user_email},
                    {'$set': {
                        'status': 'queued',
                        'job_data': {
                            'job_id': job_id,
                            'request_mode': 'avatar',
                            'status': 'queued',
                            'error': error_message,
                        },
                    }},
                )

    async def _upsert_video_record(self, user_email: str, job_id: str, request: DirectVideoRequest, result: Any) -> None:
        result_payload = _to_mongo_safe(result)
        if isinstance(result_payload, dict):
            result_payload['job_id'] = job_id
        video_record = VideoRecord(
            user_email=user_email,
            video_id=job_id,
            status='completed',
            title=result.title or f'{request.title_prefix} - {request.customer_name}',
            video_url=result.video_url,
            request_mode='avatar_async',
            job_data=result_payload,
        )
        await self.videos_collection_ref.update_one(
            {'video_id': job_id, 'user_email': user_email},
            {'$set': _to_mongo_safe(video_record)},
            upsert=True,
        )


def main() -> None:
    worker = AvatarJobWorker()
    try:
        asyncio.run(worker.run_forever())
    except KeyboardInterrupt:
        logger.info('Avatar job worker stopped by user.')


if __name__ == '__main__':
    main()
