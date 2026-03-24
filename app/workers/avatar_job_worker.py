from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any
from bson import ObjectId

from pydantic import BaseModel

from app.config import settings
from app.constants import SQS_QUEUE_URL
from app.database import videos_collection
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


def _mongo_id(value: str) -> ObjectId | str:
    cleaned = str(value)
    if ObjectId.is_valid(cleaned):
        return ObjectId(cleaned)
    return cleaned


def _parse_video_id(message: dict[str, Any]) -> str | None:
    body = message.get('Body')
    if isinstance(body, dict):
        video_id = body.get('_id')
        return str(video_id) if video_id else None
    if isinstance(body, str):
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return None
        if isinstance(payload, dict):
            video_id = payload.get('_id')
            if video_id:
                return str(video_id) or None
    return None


class AvatarJobWorker:
    def __init__(
        self,
        *,
        sqs_service: SQSService | None = None,
        video_service: VideoService | None = None,
        s3_service: S3Service | None = None,
        max_receive_count: int | None = None,
    ) -> None:
        self.sqs_service = sqs_service or SQSService()
        self.queue_url = SQS_QUEUE_URL
        self.video_service = video_service or VideoService()
        self.s3_service = s3_service or S3Service()
        self.videos_collection = videos_collection
        self.max_receive_count = max(1, int(max_receive_count or settings.sqs_max_receive_count))

    async def _find_video(self, video_id: str) -> dict[str, Any] | None:
        return await self.videos_collection.find_one({'_id': _mongo_id(video_id)})

    async def _update_video(self, query: dict[str, Any], update: dict[str, Any]) -> int:
        result = await self.videos_collection.update_one(query, update)
        return int(getattr(result, 'modified_count', 0))

    async def run_forever(self) -> None:
        while True:
            try:
                response = await asyncio.to_thread(
                    self.sqs_service.client.receive_message,
                    QueueUrl=self.queue_url,
                    MaxNumberOfMessages=5,
                    WaitTimeSeconds=max(1, settings.sqs_wait_time_seconds),
                    VisibilityTimeout=max(1, settings.sqs_visibility_timeout_seconds),
                    AttributeNames=['ApproximateReceiveCount'],
                )
                raw_messages = response.get('Messages')
                messages = [message for message in raw_messages if isinstance(message, dict)] if isinstance(raw_messages, list) else []
            except Exception:
                logger.exception('Failed while polling SQS. Retrying shortly.')
                await asyncio.sleep(2)
                continue

            if not messages:
                continue

            await asyncio.gather(*(self._process_message_safe(message) for message in messages))

    async def _process_message_safe(self, message: dict[str, Any]) -> None:
        try:
            await self.process_message(message)
        except Exception:
            logger.exception('Unhandled exception while processing SQS message.')

    async def process_message(self, message: dict[str, Any]) -> None:
        receipt_handle = str(message.get('ReceiptHandle') or '')
        video_id = _parse_video_id(message)
        if not video_id:
            logger.warning('Discarding SQS message without valid record id: %s', message.get('MessageId'))
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle, self.queue_url)
            return

        video = await self._find_video(video_id)
        if not video:
            logger.warning('Video %s not found. Removing SQS message.', video_id)
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle, self.queue_url)
            return

        # NEW: Ignore messages intended for the Remotion worker by handling them instantly
        if str(video.get("request_mode", "")).startswith("remotion"):
            logger.info("AvatarWorker intercepting and routing Remotion job %s", video_id)
            from app.workers.remotion_job_worker import RemotionJobWorker
            await RemotionJobWorker()._process_job(video_id, receipt_handle)
            return

        current_status = str(video.get('status') or 'queued').lower()
        if current_status in {'processing', 'completed', 'failed'}:
            logger.info('Video %s already in terminal/in-flight state (%s); deleting duplicate message.', video_id, current_status)
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle, self.queue_url)
            return

        started_at = datetime.utcnow()
        modified_count = await self._update_video(
            {'_id': _mongo_id(video_id), 'status': 'queued'},
            {'$set': {
                'status': 'processing',
                'updated_at': started_at,
                'started_at': started_at,
                'error': None,
            }, '$inc': {'attempts': 1}},
        )
        if modified_count == 0:
            logger.info('Video %s was claimed by another worker. Deleting duplicate message.', video_id)
            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle, self.queue_url)
            return

        claimed_video = await self._find_video(video_id)
        user_id = str(claimed_video.get('user_id') or '') if isinstance(claimed_video, dict) else ''
        request_payload = claimed_video.get('request_payload') if isinstance(claimed_video, dict) else {}
        if not isinstance(request_payload, dict):
            request_payload = {}
        if not request_payload and isinstance(claimed_video, dict):
            job_data = claimed_video.get('job_data')
            if isinstance(job_data, dict) and isinstance(job_data.get('request_payload'), dict):
                request_payload = job_data.get('request_payload') or {}
        if not isinstance(request_payload, dict):
            request_payload = {}
        if user_id:
            await self.videos_collection.update_one(
                {'_id': _mongo_id(video_id)},
                {'$set': {
                    'status': 'processing',
                    'job_data': {
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
            await self._update_video(
                {'_id': _mongo_id(video_id)},
                {'$set': {
                    'status': 'completed',
                    'result_payload': _to_mongo_safe(result),
                    'error': None,
                    'updated_at': completed_at,
                    'completed_at': completed_at,
                }},
            )

            if user_id:
                await self._upsert_video_record(user_id, video_id, request, result)

            if receipt_handle:
                await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle, self.queue_url)
            logger.info('Video %s completed successfully.', video_id)
        except Exception as exc:
            receive_count = _extract_receive_count(message)
            failed_at = datetime.utcnow()
            error_message = str(exc) or 'Unknown avatar generation error.'
            logger.exception('Video %s failed on receive count %s.', video_id, receive_count)

            if receive_count >= self.max_receive_count:
                await self._update_video(
                    {'_id': _mongo_id(video_id)},
                    {'$set': {
                        'status': 'failed',
                        'error': error_message,
                        'updated_at': failed_at,
                        'completed_at': failed_at,
                    }},
                )
                if user_id:
                    await self.videos_collection.update_one(
                        {'_id': _mongo_id(video_id)},
                        {'$set': {
                            'status': 'failed',
                            'job_data': {
                                'request_mode': 'avatar',
                                'status': 'failed',
                                'error': error_message,
                            },
                        }},
                    )
                if receipt_handle:
                    await asyncio.to_thread(self.sqs_service.delete_message, receipt_handle, self.queue_url)
                return

            await self._update_video(
                {'_id': _mongo_id(video_id)},
                {'$set': {
                    'status': 'queued',
                    'error': error_message,
                    'updated_at': failed_at,
                }},
            )
            if user_id:
                await self.videos_collection.update_one(
                    {'_id': _mongo_id(video_id)},
                    {'$set': {
                        'status': 'queued',
                        'job_data': {
                            'request_mode': 'avatar',
                            'status': 'queued',
                            'error': error_message,
                        },
                    }},
                )

    async def _upsert_video_record(self, user_id: str, video_id: str, request: DirectVideoRequest, result: Any) -> None:
        result_payload = _to_mongo_safe(result)
        video_record = VideoRecord(
            user_id=user_id,
            status='completed',
            title=result.title or f'{request.title_prefix} - {request.customer_name}',
            video_url=result.video_url,
            request_mode='avatar_async',
            job_data=result_payload,
        )
        await self.videos_collection.update_one(
            {'_id': _mongo_id(video_id)},
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
