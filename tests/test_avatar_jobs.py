import asyncio
import copy
import json
import os
from datetime import datetime
from typing import Any

import pytest
from fastapi import HTTPException

os.environ.setdefault('HEYGEN_API_KEY', 'test-key')

import app.main as main_module
from app.models import DirectVideoRequest, VideoJobResult
from app.services.sqs_service import SQSService
from app.workers.avatar_job_worker import AvatarJobWorker


class _UpdateResult:
    def __init__(self, modified_count: int) -> None:
        self.modified_count = modified_count


class InMemoryCollection:
    def __init__(self) -> None:
        self.docs: dict[str, dict[str, Any]] = {}

    async def insert_one(self, doc: dict[str, Any]) -> None:
        document = copy.deepcopy(doc)
        key = str(document.get('job_id') or document.get('video_id'))
        if not key:
            raise AssertionError('Expected job_id or video_id in insert doc')
        self.docs[key] = document

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        for doc in self.docs.values():
            if all(doc.get(key) == value for key, value in query.items()):
                return copy.deepcopy(doc)
        return None

    async def update_one(self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False) -> _UpdateResult:
        target_key: str | None = None
        for key, doc in self.docs.items():
            if all(doc.get(field) == value for field, value in query.items()):
                target_key = key
                break

        if target_key is None:
            if not upsert:
                return _UpdateResult(0)
            if query.get('job_id'):
                target_key = str(query['job_id'])
            elif query.get('video_id'):
                target_key = str(query['video_id'])
            else:
                return _UpdateResult(0)
            self.docs[target_key] = {'job_id': query.get('job_id'), 'video_id': query.get('video_id')}

        doc = self.docs[target_key]
        for key, value in update.get('$set', {}).items():
            doc[key] = copy.deepcopy(value)
        for key, value in update.get('$inc', {}).items():
            doc[key] = int(doc.get(key, 0)) + int(value)
        return _UpdateResult(1)


class FakeSQSForApi:
    def __init__(self) -> None:
        self.sent_job_ids: list[str] = []

    def is_configured(self) -> bool:
        return True

    def send_avatar_job(self, job_id: str) -> dict[str, str]:
        self.sent_job_ids.append(job_id)
        return {'MessageId': 'mid-1'}


class FakeSQSForWorker:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    def is_configured(self) -> bool:
        return True

    def receive_jobs(self, max_messages: int = 1) -> list[dict[str, Any]]:  # pragma: no cover - not used in tests
        return []

    def delete_message(self, receipt_handle: str) -> None:
        self.deleted.append(receipt_handle)


class FakeS3Service:
    def upload_video(self, local_path: Any, s3_key: str) -> str | None:
        return None


class FakeVideoServiceSuccess:
    def generate_direct(self, request: DirectVideoRequest, *, wait: bool = True) -> VideoJobResult:
        assert wait is True
        assert request.customer_name
        return VideoJobResult(
            request_mode='direct',
            video_id='video_123',
            status='completed',
            video_url='https://example.com/video_123.mp4',
            thumbnail_url='https://example.com/video_123.jpg',
            title='Test Video',
            raw_response={'status': 'completed'},
            saved_to=None,
        )


class FakeVideoServiceFail:
    def generate_direct(self, request: DirectVideoRequest, *, wait: bool = True) -> VideoJobResult:
        raise RuntimeError('provider failed')


def _build_direct_request() -> DirectVideoRequest:
    return DirectVideoRequest(
        customer_name='Aditi',
        lan='LAN001',
        client_name='Credhas',
        avatar_id='avatar_1',
        language='Hindi',
        script_text='Hello {{customer_name}}',
    )


def test_sqs_service_send_avatar_job_contains_only_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeBotoClient:
        def __init__(self) -> None:
            self.calls: list[dict[str, Any]] = []

        def send_message(self, **kwargs: Any) -> dict[str, str]:
            self.calls.append(kwargs)
            return {'MessageId': 'mid-123'}

    fake_client = _FakeBotoClient()
    monkeypatch.setattr('app.services.sqs_service.boto3.client', lambda *args, **kwargs: fake_client)

    service = SQSService(queue_url='https://sqs.us-east-1.amazonaws.com/12345/avatar-jobs')
    service.send_avatar_job('job_123')

    assert len(fake_client.calls) == 1
    payload = json.loads(fake_client.calls[0]['MessageBody'])
    assert payload == {'job_id': 'job_123', 'request_mode': 'avatar'}


def test_post_jobs_avatar_creates_job_and_sends_sqs(monkeypatch: pytest.MonkeyPatch) -> None:
    jobs_collection = InMemoryCollection()
    sqs_service = FakeSQSForApi()
    monkeypatch.setattr(main_module, 'video_jobs_collection', jobs_collection)
    monkeypatch.setattr(main_module, 'sqs_service', sqs_service)

    response = asyncio.run(main_module.create_avatar_job(_build_direct_request(), current_user='user@example.com'))

    assert response.status == 'queued'
    assert response.job_id
    assert sqs_service.sent_job_ids == [response.job_id]
    assert response.job_id in jobs_collection.docs
    stored = jobs_collection.docs[response.job_id]
    assert stored['status'] == 'queued'
    assert stored['request_payload']['customer_name'] == 'Aditi'
    assert stored['request_payload']['lan'] == 'LAN001'


def test_get_jobs_status_enforces_ownership(monkeypatch: pytest.MonkeyPatch) -> None:
    jobs_collection = InMemoryCollection()
    job_id = 'job_001'
    jobs_collection.docs[job_id] = {
        'job_id': job_id,
        'user_email': 'owner@example.com',
        'status': 'completed',
        'request_payload': {'customer_name': 'Aditi'},
        'result_payload': {
            'video_id': 'video_001',
            'video_url': 'https://example.com/video_001.mp4',
            'thumbnail_url': 'https://example.com/video_001.jpg',
            'title': 'Owner Video',
        },
        'error': None,
        'attempts': 1,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    monkeypatch.setattr(main_module, 'video_jobs_collection', jobs_collection)

    status_ok = asyncio.run(main_module.get_avatar_job_status(job_id, current_user='owner@example.com'))
    assert status_ok.status == 'completed'
    assert status_ok.video_id == 'video_001'
    assert status_ok.video_url == 'https://example.com/video_001.mp4'

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(main_module.get_avatar_job_status(job_id, current_user='other@example.com'))
    assert exc_info.value.status_code == 404


def test_worker_success_moves_job_to_completed() -> None:
    jobs_collection = InMemoryCollection()
    videos_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    jobs_collection.docs['job_success'] = {
        'job_id': 'job_success',
        'user_email': 'user@example.com',
        'status': 'queued',
        'request_payload': _build_direct_request().model_dump(mode='python'),
        'result_payload': None,
        'error': None,
        'attempts': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    worker = AvatarJobWorker(
        sqs_service=sqs_service,
        video_service=FakeVideoServiceSuccess(),
        s3_service=FakeS3Service(),
        jobs_collection=jobs_collection,
        videos_collection_ref=videos_collection,
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'job_id': 'job_success', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-success',
        'Attributes': {'ApproximateReceiveCount': '1'},
    }))

    job = jobs_collection.docs['job_success']
    assert job['status'] == 'completed'
    assert job['attempts'] == 1
    assert job['result_payload']['video_id'] == 'video_123'
    assert sqs_service.deleted == ['rh-success']
    assert 'video_123' in videos_collection.docs


def test_worker_retry_path_keeps_message_for_retry() -> None:
    jobs_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    jobs_collection.docs['job_retry'] = {
        'job_id': 'job_retry',
        'user_email': 'user@example.com',
        'status': 'queued',
        'request_payload': _build_direct_request().model_dump(mode='python'),
        'result_payload': None,
        'error': None,
        'attempts': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    worker = AvatarJobWorker(
        sqs_service=sqs_service,
        video_service=FakeVideoServiceFail(),
        s3_service=FakeS3Service(),
        jobs_collection=jobs_collection,
        videos_collection_ref=InMemoryCollection(),
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'job_id': 'job_retry', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-retry',
        'Attributes': {'ApproximateReceiveCount': '1'},
    }))

    job = jobs_collection.docs['job_retry']
    assert job['status'] == 'queued'
    assert job['attempts'] == 1
    assert 'provider failed' in (job.get('error') or '')
    assert sqs_service.deleted == []


def test_worker_marks_failed_after_max_receive_count() -> None:
    jobs_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    jobs_collection.docs['job_fail'] = {
        'job_id': 'job_fail',
        'user_email': 'user@example.com',
        'status': 'queued',
        'request_payload': _build_direct_request().model_dump(mode='python'),
        'result_payload': None,
        'error': None,
        'attempts': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    worker = AvatarJobWorker(
        sqs_service=sqs_service,
        video_service=FakeVideoServiceFail(),
        s3_service=FakeS3Service(),
        jobs_collection=jobs_collection,
        videos_collection_ref=InMemoryCollection(),
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'job_id': 'job_fail', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-fail',
        'Attributes': {'ApproximateReceiveCount': '3'},
    }))

    job = jobs_collection.docs['job_fail']
    assert job['status'] == 'failed'
    assert job['attempts'] == 1
    assert 'provider failed' in (job.get('error') or '')
    assert sqs_service.deleted == ['rh-fail']


def test_worker_idempotency_deletes_duplicate_messages() -> None:
    jobs_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    jobs_collection.docs['job_done'] = {
        'job_id': 'job_done',
        'user_email': 'user@example.com',
        'status': 'completed',
        'request_payload': _build_direct_request().model_dump(mode='python'),
        'result_payload': {'video_id': 'video_123'},
        'error': None,
        'attempts': 1,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'completed_at': datetime.utcnow(),
    }
    worker = AvatarJobWorker(
        sqs_service=sqs_service,
        video_service=FakeVideoServiceSuccess(),
        s3_service=FakeS3Service(),
        jobs_collection=jobs_collection,
        videos_collection_ref=InMemoryCollection(),
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'job_id': 'job_done', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-dup',
        'Attributes': {'ApproximateReceiveCount': '2'},
    }))

    assert sqs_service.deleted == ['rh-dup']
