from __future__ import annotations

import json
from typing import Any

import boto3

from app.config import settings
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

    def receive_messages(self, queue_url: str, max_messages: int = 1) -> list[dict[str, Any]]:
        response = self.client.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=max_messages,
            WaitTimeSeconds=settings.sqs_wait_time_seconds,
        )
        return response.get('Messages', [])

    def delete_message(self, receipt_handle: str, queue_url: str) -> None:
        self.client.delete_message(
            QueueUrl=queue_url,
            ReceiptHandle=receipt_handle,
        )
