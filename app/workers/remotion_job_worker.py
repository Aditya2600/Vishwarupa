from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from app.config import settings
from app.database import videos_collection
from app.models import VideoRecord, RemotionVideoRequest
from app.services.sqs_service import SQSService
from app.services.remotion_service import RemotionService
from app.services.s3_service import S3Service

logger = logging.getLogger("app")


def _to_mongo_safe(obj: Any) -> Any:
    """Recursively convert Pydantic models and Paths to JSON-safe types."""
    from pathlib import Path
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
    Mirrors the AvatarJobWorker pattern — but calls RemotionService instead of VideoService.
    """

    def __init__(self) -> None:
        self.sqs_service = SQSService()
        self.remotion_service = RemotionService()
        self.s3_service = S3Service()
        self.videos_collection_ref = videos_collection

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
        if not self.sqs_service.is_configured():
            return

        try:
            messages = self.sqs_service.receive_messages(max_messages=5)
        except Exception as exc:
            logger.error(f"RemotionJobWorker: Failed to receive SQS messages: {exc}")
            return

        for message in messages:
            try:
                # SQS messages from Aditya branch might use '_id', ours use 'job_id'
                body = message.get("body", {})
                request_mode = body.get("request_mode", "")

                # Only handle remotion jobs in this worker
                if request_mode != "remotion":
                    continue

                job_id = body.get("job_id") or body.get("_id")
                receipt_handle = message.get("receipt_handle")

                if not job_id:
                    logger.warning(f"RemotionJobWorker: Received message with no job_id/id: {body}, skipping.")
                    if receipt_handle:
                        self.sqs_service.delete_message(receipt_handle)
                    continue

                await self._process_job(job_id, receipt_handle)

            except Exception as exc:
                logger.error(f"RemotionJobWorker: Error processing message: {exc}")

    async def _process_job(self, job_id: str, receipt_handle: str | None) -> None:
        """Fetch job from MongoDB, run Remotion generation, and update the record."""
        # 1. Fetch full job document from MongoDB
        job_doc = await self.videos_collection_ref.find_one(
            {"video_id": job_id, "request_mode": "remotion_async"}
        )

        if not job_doc:
            logger.warning(f"RemotionJobWorker: No job found for job_id={job_id}. It may have been processed already.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle)
            return

        user_email = job_doc.get("user_email", "")
        job_data = job_doc.get("job_data", {})
        request_payload = job_data.get("request_payload", {})

        # 2. Check if already completed/processing (avoid duplicate processing)
        current_status = job_doc.get("status", "queued")
        if current_status in ("completed", "failed"):
            logger.info(f"RemotionJobWorker: job_id={job_id} already in status={current_status}. Deleting from SQS.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle)
            return

        # 3. Mark as processing
        now = datetime.utcnow()
        await self.videos_collection_ref.update_one(
            {"video_id": job_id},
            {"$set": {
                "status": "processing",
                "updated_at": now,
                "started_at": now,
                "job_data.status": "processing",
            }}
        )
        logger.info(f"RemotionJobWorker: Processing job_id={job_id} for user={user_email}")

        try:
            # 4. Reconstruct the RemotionVideoRequest from stored payload
            remotion_request = RemotionVideoRequest.model_validate(request_payload)

            # 5. Generate the video using RemotionService
            result = await self.remotion_service.generate_video(remotion_request)

            # 6. Upload to S3
            video_path = result.get("video_path")
            video_url = f"/api/artifacts/{result['video_path'].relative_to(settings.output_dir).as_posix()}"
            if video_path:
                s3_url = self.s3_service.upload_video(video_path, f"videos/{job_id}.mp4")
                if s3_url:
                    video_url = s3_url

            # 7. Build the result payload
            result_payload = {
                "video_id": job_id,
                "video_url": video_url,
                "status": "completed",
                "request_mode": "remotion_async",
            }

            # 8. Update MongoDB to completed
            completed_at = datetime.utcnow()
            await self.videos_collection_ref.update_one(
                {"video_id": job_id},
                {"$set": {
                    "status": "completed",
                    "video_url": video_url,
                    "updated_at": completed_at,
                    "completed_at": completed_at,
                    "job_data.status": "completed",
                    "result_payload": _to_mongo_safe(result_payload),
                }}
            )
            logger.info(f"RemotionJobWorker: job_id={job_id} completed successfully. URL={video_url}")

        except Exception as exc:
            # 9. Mark as failed in MongoDB
            error_message = str(exc)
            failed_at = datetime.utcnow()
            await self.videos_collection_ref.update_one(
                {"video_id": job_id},
                {"$set": {
                    "status": "failed",
                    "updated_at": failed_at,
                    "completed_at": failed_at,
                    "job_data.status": "failed",
                    "job_data.error": error_message,
                }}
            )
            logger.error(f"RemotionJobWorker: job_id={job_id} FAILED: {error_message}")

        finally:
            # 10. Always delete the message from SQS so it doesn't re-queue
            if receipt_handle:
                try:
                    self.sqs_service.delete_message(receipt_handle)
                except Exception as exc:
                    logger.error(f"RemotionJobWorker: Failed to delete SQS message: {exc}")


def main() -> None:
    worker = RemotionJobWorker()
    try:
        asyncio.run(worker.run_forever())
    except KeyboardInterrupt:
        logger.info("RemotionJobWorker: Stopped by user.")


if __name__ == "__main__":
    main()
