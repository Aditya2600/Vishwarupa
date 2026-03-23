from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Any
from bson import ObjectId

from app.config import settings
from app.constants import SQS_QUEUE_URL
from app.database import videos_collection
from app.models import VideoRecord, RemotionVideoRequest
from app.services.sqs_service import SQSService
from app.services.remotion_service import RemotionService
from app.services.s3_service import S3Service

logger = logging.getLogger("app")


def _to_mongo_safe(obj: Any) -> Any:
    """Recursively convert Pydantic models and Paths to JSON-safe types."""
    if hasattr(obj, "model_dump"):
        obj = obj.model_dump(mode="python")
    if isinstance(obj, dict):
        return {k: _to_mongo_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_mongo_safe(v) for v in obj]
    if isinstance(obj, Path):
        return str(obj)
    return obj


class RemotionJobWorker:
    """
    Polls the SQS queue for Remotion video generation jobs and processes them.
    Mirrors the AvatarJobWorker pattern.
    """

    def __init__(self) -> None:
        self.sqs_service = SQSService()
        self.remotion_service = RemotionService()
        self.s3_service = S3Service()
        self.videos_collection_ref = videos_collection
        self.queue_url = SQS_QUEUE_URL

    async def run_forever(self) -> None:
        """Continuously poll SQS for remotion jobs until the process is killed."""
        logger.info("RemotionJobWorker: Starting SQS polling loop...")
        while True:
            try:
                await self._poll_once()
            except Exception as exc:
                logger.error(f"RemotionJobWorker: Unexpected error in poll loop: {exc}")
            await asyncio.sleep(settings.sqs_poll_interval_seconds if hasattr(settings, 'sqs_poll_interval_seconds') else 5)

    async def _poll_once(self) -> None:
        """Fetch one batch of messages from SQS and process them."""
        try:
            messages = self.sqs_service.receive_messages(queue_url=self.queue_url, max_messages=settings.sqs_max_receive_count)
            for message in messages:
                import json
                body_raw = message.get("Body", "{}")
                try:
                    body = json.loads(body_raw)
                except Exception:
                    body = {}

                # STANDARD: use video_id consistently
                video_id = body.get('video_id') or body.get('job_id') or body.get('_id')
                receipt_handle = message.get("ReceiptHandle")

                if not video_id:
                    logger.warning(f"RemotionJobWorker: Received message with no video_id/job_id: {body}, skipping.")
                    if receipt_handle:
                        self.sqs_service.delete_message(receipt_handle, self.queue_url)
                    continue

                await self._process_job(str(video_id), receipt_handle)

        except Exception as exc:
            logger.error(f"RemotionJobWorker: Error processing message: {exc}")

    async def _process_job(self, video_id: str, receipt_handle: str | None) -> None:
        """Fetch job from MongoDB, run Remotion generation, and update the record."""
        # 1. Fetch full job document from MongoDB
        job_doc = await self.videos_collection_ref.find_one(
            {"_id": ObjectId(video_id)}
        )

        if not job_doc:
            logger.warning(f"RemotionJobWorker: No job found for video_id={video_id}. It may have been processed already.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return

        # 2. Check if already completed/processing
        current_status = job_doc.get("status", "queued")
        if current_status in ("completed", "failed"):
            logger.info(f"RemotionJobWorker: video_id={video_id} already in status={current_status}. Deleting from SQS.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return

        # 3. Mark as processing
        now = datetime.utcnow()
        await self.videos_collection_ref.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": {
                "status": "processing",
                "updated_at": now,
            }}
        )

        try:
            # 4. Generate Remotion video
            raw_payload = job_doc.get("job_data", {}).get("request_payload", {})
            remotion_req = RemotionVideoRequest(**raw_payload)
            
            # Pass the video_id down to consolidate all file naming
            result_payload = await self.remotion_service.generate_video(remotion_req, video_id=video_id)
            result_path = result_payload["video_path"]
            
            # 5. Upload to S3
            s3_key = f"videos/{video_id}.mp4"
            final_url = self.s3_service.upload_video(result_path, s3_key)
            
            # 6. Update MongoDB to completed
            await self.videos_collection_ref.update_one(
                {"_id": ObjectId(video_id)},
                {"$set": {
                    "status": "completed",
                    "video_url": final_url,
                    "updated_at": datetime.utcnow(),
                }}
            )
            
            # 7. Delete from SQS
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)

        except Exception as exc:
            logger.error(f"RemotionJobWorker: Failed to process video_id={video_id}: {exc}")
            await self.videos_collection_ref.update_one(
                {"video_id": video_id},
                {"$set": {
                    "status": "failed",
                    "error_message": str(exc),
                    "updated_at": datetime.utcnow(),
                }}
            )
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)


def main():
    worker = RemotionJobWorker()
    try:
        asyncio.run(worker.run_forever())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")


if __name__ == "__main__":
    main()
