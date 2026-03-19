from __future__ import annotations

import json
from typing import Any

import boto3

from app.config import settings
from app.constants import SQS_QUEUE_URL
import logging

logger = logging.getLogger("app")
logger.setLevel(logging.INFO)

formatter = logging.Formatter(
    "%(asctime)s | %(levelname)s | %(message)s"
)


class SQSService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(SQSService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, queue_url: str | None = None) -> None:
        if self._initialized:
            return
            
        self.queue_url = SQS_QUEUE_URL
        client_kwargs: dict[str, Any] = {'region_name': settings.aws_region}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            client_kwargs['aws_access_key_id'] = settings.aws_access_key_id
            client_kwargs['aws_secret_access_key'] = settings.aws_secret_access_key
        self.client = boto3.client('sqs', **client_kwargs)
        self._initialized = True

    def is_configured(self) -> bool:
        return bool(self.queue_url)

    def send_job(self, job_id: str) -> dict[str, Any]:
        if not self.queue_url:
            raise RuntimeError('SQS queue is not configured. Set SQS_QUEUE_URL to enable avatar async jobs.')
        payload = {'job_id': job_id, 'request_mode': 'avatar'}
        return self.client.send_message(
            QueueUrl=self.queue_url,
            MessageBody=json.dumps(payload),
        )

    def receive_jobs(self, max_messages: int = 1) -> list[dict[str, Any]]:
        if not self.queue_url:
            raise RuntimeError('SQS queue is not configured. Set SQS_QUEUE_URL to enable avatar async jobs.')
        response = self.client.receive_message(
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=max(1, min(max_messages, 10)),
            WaitTimeSeconds=max(1, settings.sqs_wait_time_seconds),
            VisibilityTimeout=max(1, settings.sqs_visibility_timeout_seconds),
            AttributeNames=['ApproximateReceiveCount'],
        )
        messages = response.get('Messages')
        if not isinstance(messages, list):
            return []
        return [message for message in messages if isinstance(message, dict)]

    def delete_message(self, receipt_handle: str) -> None:
        if not self.queue_url:
            raise RuntimeError('SQS queue is not configured. Set SQS_QUEUE_URL to enable avatar async jobs.')
        self.client.delete_message(
            QueueUrl=self.queue_url,
            ReceiptHandle=receipt_handle,
        )
