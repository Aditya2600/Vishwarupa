from datetime import datetime, timedelta
import os

os.environ.setdefault("HEYGEN_API_KEY", "test")
os.environ.setdefault("FRONTEND_URL", "http://localhost")
os.environ.setdefault("CPAAS_API_BASE_URL", "http://localhost")

from app.workers.remotion_job_worker import _stale_processing_cutoff


def test_stale_processing_cutoff_uses_render_timeout_plus_visibility_timeout() -> None:
    now = datetime(2026, 1, 1, 0, 0, 0)
    assert _stale_processing_cutoff(now, 600, 120) == now - timedelta(seconds=720)

