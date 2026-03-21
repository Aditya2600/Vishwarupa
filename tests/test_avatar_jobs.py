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
import app.workers.avatar_job_worker as worker_module
from app.models import DirectVideoRequest, VideoJobResult
from app.services.sqs_service import SQSService
from app.workers.avatar_job_worker import AvatarJobWorker


class _UpdateResult:
    def __init__(self, modified_count: int) -> None:
        self.modified_count = modified_count


class _InsertResult:
    def __init__(self, inserted_id: str) -> None:
        self.inserted_id = inserted_id


class InMemoryCollection:
    def __init__(self) -> None:
        self.docs: dict[str, dict[str, Any]] = {}
        self._next_id = 1

    @staticmethod
    def _matches(doc: dict[str, Any], query: dict[str, Any]) -> bool:
        for key, value in query.items():
            if key == '$or':
                if not isinstance(value, list) or not any(InMemoryCollection._matches(doc, item) for item in value if isinstance(item, dict)):
                    return False
                continue
            doc_value = doc.get(key)
            if key.endswith('_id') or key == '_id':
                if str(doc_value) != str(value):
                    return False
                continue
            if doc_value != value:
                return False
        return True

    async def insert_one(self, doc: dict[str, Any]) -> _InsertResult:
        document = copy.deepcopy(doc)
        if not document.get('_id'):
            document['_id'] = f'record_{self._next_id}'
            self._next_id += 1
        key = str(document.get('_id'))
        self.docs[key] = document
        return _InsertResult(key)

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        for doc in self.docs.values():
            if self._matches(doc, query):
                return copy.deepcopy(doc)
        return None

    async def update_one(self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False) -> _UpdateResult:
        target_key: str | None = None
        for key, doc in self.docs.items():
            if self._matches(doc, query):
                target_key = key
                break

        if target_key is None:
            if not upsert:
                return _UpdateResult(0)
            if query.get('_id'):
                target_key = str(query['_id'])
            else:
                return _UpdateResult(0)
            self.docs[target_key] = {'_id': target_key}

        doc = self.docs[target_key]
        for key, value in update.get('$set', {}).items():
            doc[key] = copy.deepcopy(value)
        for key, value in update.get('$inc', {}).items():
            doc[key] = int(doc.get(key, 0)) + int(value)
        return _UpdateResult(1)


class FakeSQSForApi:
    def __init__(self) -> None:
        self.sent_payloads: list[dict[str, Any]] = []

    def send_job(self, payload: dict[str, Any], queue_url: str) -> dict[str, str]:
        self.sent_payloads.append(copy.deepcopy(payload))
        return {'MessageId': 'mid-1'}


class FakeSQSForWorker:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    def receive_jobs(self, queue_url: str, max_messages: int = 1) -> list[dict[str, Any]]:  # pragma: no cover - not used in tests
        return []

    def delete_message(self, receipt_handle: str, queue_url: str) -> None:
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
    SQSService._instance = None
    monkeypatch.setattr('app.services.sqs_service.boto3.client', lambda *args, **kwargs: fake_client)

    service = SQSService()
    service.send_job(
        payload={'_id': 'record_123', 'request_mode': 'avatar'},
        queue_url='https://sqs.us-east-1.amazonaws.com/12345/avatar-jobs',
    )

    assert len(fake_client.calls) == 1
    payload = json.loads(fake_client.calls[0]['MessageBody'])
    assert payload == {'_id': 'record_123', 'request_mode': 'avatar'}
    SQSService._instance = None


def test_post_jobs_avatar_creates_job_and_sends_sqs(monkeypatch: pytest.MonkeyPatch) -> None:
    videos_collection = InMemoryCollection()
    sqs_service = FakeSQSForApi()
    monkeypatch.setattr(main_module, 'videos_collection', videos_collection)
    monkeypatch.setattr(main_module, 'sqs_service', sqs_service)

    response = asyncio.run(main_module.create_avatar_job(_build_direct_request(), current_user='user_001'))

    assert response.status == 'queued'
    assert response.id
    assert sqs_service.sent_payloads == [{'_id': response.id, 'request_mode': 'avatar'}]
    assert response.id in videos_collection.docs
    stored = videos_collection.docs[response.id]
    assert stored['status'] == 'queued'
    assert stored['request_payload']['customer_name'] == 'Aditi'
    assert stored['request_payload']['lan'] == 'LAN001'
    assert str(stored['_id']) == response.id
    assert stored['request_mode'] == 'avatar_async'


def test_get_jobs_status_enforces_ownership(monkeypatch: pytest.MonkeyPatch) -> None:
    videos_collection = InMemoryCollection()
    job_id = 'record_001'
    videos_collection.docs[job_id] = {
        '_id': job_id,
        'request_mode': 'avatar_async',
        'user_id': 'user_owner_001',
        'status': 'completed',
        'request_payload': {'customer_name': 'Aditi', 'lan': 'LAN001'},
        'result_payload': {
            'video_id': 'provider_video_001',
            'video_url': 'https://example.com/video_001.mp4',
            'thumbnail_url': 'https://example.com/video_001.jpg',
            'title': 'Owner Video',
        },
        'error': None,
        'attempts': 1,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    monkeypatch.setattr(main_module, 'videos_collection', videos_collection)

    status_ok = asyncio.run(main_module.get_avatar_job_status(job_id, current_user='user_owner_001'))
    assert status_ok.status == 'completed'
    assert status_ok.id == 'record_001'
    assert status_ok.video_url == 'https://example.com/video_001.mp4'

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(main_module.get_avatar_job_status(job_id, current_user='user_other_001'))
    assert exc_info.value.status_code == 404


def test_worker_success_moves_job_to_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    shared_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    monkeypatch.setattr(worker_module, 'videos_collection', shared_collection)
    shared_collection.docs['record_success'] = {
        '_id': 'record_success',
        'request_mode': 'avatar_async',
        'user_id': 'user_001',
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
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'_id': 'record_success', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-success',
        'Attributes': {'ApproximateReceiveCount': '1'},
    }))

    job = shared_collection.docs['record_success']
    assert job['status'] == 'completed'
    assert job['attempts'] == 1
    assert job['result_payload']['video_id'] == 'video_123'
    assert sqs_service.deleted == ['rh-success']
    assert 'record_success' in shared_collection.docs


def test_worker_retry_path_keeps_message_for_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    jobs_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    monkeypatch.setattr(worker_module, 'videos_collection', jobs_collection)
    jobs_collection.docs['record_retry'] = {
        '_id': 'record_retry',
        'request_mode': 'avatar_async',
        'user_id': 'user_001',
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
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'_id': 'record_retry', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-retry',
        'Attributes': {'ApproximateReceiveCount': '1'},
    }))

    job = jobs_collection.docs['record_retry']
    assert job['status'] == 'queued'
    assert job['attempts'] == 1
    assert 'provider failed' in (job.get('error') or '')
    assert sqs_service.deleted == []


def test_worker_marks_failed_after_max_receive_count(monkeypatch: pytest.MonkeyPatch) -> None:
    jobs_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    monkeypatch.setattr(worker_module, 'videos_collection', jobs_collection)
    jobs_collection.docs['record_fail'] = {
        '_id': 'record_fail',
        'request_mode': 'avatar_async',
        'user_id': 'user_001',
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
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'_id': 'record_fail', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-fail',
        'Attributes': {'ApproximateReceiveCount': '3'},
    }))

    job = jobs_collection.docs['record_fail']
    assert job['status'] == 'failed'
    assert job['attempts'] == 1
    assert 'provider failed' in (job.get('error') or '')
    assert sqs_service.deleted == ['rh-fail']


def test_worker_idempotency_deletes_duplicate_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    jobs_collection = InMemoryCollection()
    sqs_service = FakeSQSForWorker()
    monkeypatch.setattr(worker_module, 'videos_collection', jobs_collection)
    jobs_collection.docs['record_done'] = {
        '_id': 'record_done',
        'request_mode': 'avatar_async',
        'user_id': 'user_001',
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
        max_receive_count=3,
    )

    asyncio.run(worker.process_message({
        'Body': json.dumps({'_id': 'record_done', 'request_mode': 'avatar'}),
        'ReceiptHandle': 'rh-dup',
        'Attributes': {'ApproximateReceiveCount': '2'},
    }))

    assert sqs_service.deleted == ['rh-dup']
