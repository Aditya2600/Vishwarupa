import os
from types import SimpleNamespace

os.environ.setdefault('HEYGEN_API_KEY', 'test-key')

import app.main as main_module
from app.services.video_service import VideoService


class FakeClient:
    def get_video_status(self, video_id: str) -> dict:
        assert video_id == 'video_123'
        return {
            'data': {
                'status': 'completed',
                'video_url': 'https://example.com/video.mp4',
                'thumbnail_url': 'https://example.com/thumb.jpg',
                'title': 'Loan Recall',
            }
        }


def test_get_video_status_result_returns_video_job_result() -> None:
    service = VideoService(client=FakeClient())

    result = service.get_video_status_result('video_123')

    assert result.video_id == 'video_123'
    assert result.status == 'completed'
    assert result.video_url == 'https://example.com/video.mp4'
    assert result.thumbnail_url == 'https://example.com/thumb.jpg'
    assert result.title == 'Loan Recall'


class FakeS3Service:
    def __init__(self) -> None:
        self.calls: list[tuple[str, int]] = []

    def generate_presigned_video_url(self, s3_key: str, expires_in: int = 3600) -> str | None:
        self.calls.append((s3_key, expires_in))
        return f'https://signed.example/{s3_key}?expires={expires_in}'


def test_presign_s3_video_url_converts_stable_s3_url(monkeypatch) -> None:
    fake_s3_service = FakeS3Service()
    monkeypatch.setattr(main_module, 's3_service', fake_s3_service)
    monkeypatch.setattr(main_module, 'settings', SimpleNamespace(aws_region='us-east-1'))

    result = main_module._presign_s3_video_url(
        'https://vishvarupa.s3.us-east-1.amazonaws.com/videos/video.mp4'
    )

    assert result == 'https://signed.example/videos/video.mp4?expires=3600'
    assert fake_s3_service.calls == [('videos/video.mp4', 3600)]
