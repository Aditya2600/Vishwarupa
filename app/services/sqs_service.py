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

    def __init__(self) -> None:
        if self._initialized:
            return

        client_kwargs: dict[str, Any] = {'region_name': settings.aws_region}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            client_kwargs['aws_access_key_id'] = settings.aws_access_key_id
            client_kwargs['aws_secret_access_key'] = settings.aws_secret_access_key
        self.client = boto3.client('sqs', **client_kwargs)
        self._initialized = True

    def send_job(self, payload: dict[str, Any], queue_url: str) -> dict[str, Any]:
        return self.client.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(payload),
        )

    def delete_message(self, receipt_handle: str, queue_url: str | None = None) -> None:
        url = queue_url or settings.sqs_queue_url or SQS_QUEUE_URL
            
        self.client.delete_message(
            QueueUrl=url,
            ReceiptHandle=receipt_handle,
        )

    def is_configured(self) -> bool:
        """Check if AWS credentials and region are provided."""
        return bool(settings.aws_region)

    def receive_messages(self, queue_url: str | None = None, max_messages: int = 1) -> list[dict[str, Any]]:
        """Receive a batch of messages from the SQS queue."""
        url = queue_url or settings.sqs_queue_url or SQS_QUEUE_URL

        response = self.client.receive_message(
            QueueUrl=url,
            MaxNumberOfMessages=max_messages,
            WaitTimeSeconds=settings.sqs_wait_time_seconds,
            VisibilityTimeout=settings.sqs_visibility_timeout_seconds,
            AttributeNames=['ApproximateReceiveCount']
        )
        return response.get('Messages', [])
