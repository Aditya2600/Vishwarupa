from datetime import datetime, timedelta
import os

os.environ.setdefault("HEYGEN_API_KEY", "test")
os.environ.setdefault("FRONTEND_URL", "http://localhost")
os.environ.setdefault("CPAAS_API_BASE_URL", "http://localhost")

from app.workers.job_worker import _stale_processing_cutoff
from app.workers.job_worker import JobWorker


def test_stale_processing_cutoff_uses_heygen_poll_timeout_plus_visibility_timeout() -> None:
    now = datetime(2026, 1, 1, 0, 0, 0)
    assert _stale_processing_cutoff(now, 2400, 120) == now - timedelta(seconds=2520)


class _Result:
    def __init__(self, modified_count: int = 1) -> None:
        self.modified_count = modified_count


class _Videos:
    def __init__(self) -> None:
        self.calls: list[tuple[dict, dict]] = []

    async def update_many(self, query, update):
        self.calls.append((query, update))
        return _Result()


async def test_reaper_marks_stale_processing_avatar_and_remotion_jobs_failed() -> None:
    worker = JobWorker(sqs_service=object(), video_service=object(), s3_service=object())
    videos = _Videos()
    worker.videos_collection = videos

    # JobWorker now reaps both avatar and Remotion/hybrid stale jobs, with a
    # separate update_many (and cutoff) per family. Each mock call reports one job.
    assert await worker.reap_stale_processing_jobs() == 2
    assert len(videos.calls) == 2

    avatar_query, avatar_update = videos.calls[0]
    assert avatar_query["status"] == "processing"
    assert avatar_query["request_mode"] == "avatar_async"
    assert "$lt" in avatar_query["updated_at"]
    assert avatar_update["$set"]["status"] == "failed"
    assert avatar_update["$set"]["job_data.status"] == "failed"

    remotion_query, remotion_update = videos.calls[1]
    assert remotion_query["request_mode"] == {"$regex": "remotion", "$options": "i"}
    assert "$lt" in remotion_query["updated_at"]
    assert remotion_update["$set"]["status"] == "failed"
