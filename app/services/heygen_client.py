from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import httpx

from app.config import settings


class HeyGenClient:
    def __init__(self) -> None:
        self.base_url = settings.heygen_base_url.rstrip('/')
        self.headers = {
            'X-Api-Key': settings.heygen_api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def _url(self, path: str) -> str:
        return f'{self.base_url}{path}'

    @staticmethod
    def summarize_provider_error(payload: dict[str, Any] | str) -> str:
        if isinstance(payload, str):
            normalized = payload.strip()
            return normalized or 'Video generation failed. Please try again in a moment.'

        data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
        error = data.get('error') if isinstance(data.get('error'), dict) else {}

        code = str(error.get('code') or '').strip()
        detail = str(error.get('detail') or '').strip()
        message = str(error.get('message') or payload.get('message') or '').strip()

        if code == 'MOVIO_PAYMENT_INSUFFICIENT_CREDIT' or 'insufficient credit' in detail.lower():
            return "You don't have enough credits to generate this video."

        if detail:
            return detail
        if message and message.lower() != 'success':
            return message

        return 'Video generation failed. Please try again in a moment.'

    def _raise_for_status(self, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = ''
            try:
                detail = json.dumps(response.json(), ensure_ascii=False)
            except Exception:
                detail = response.text
            raise RuntimeError(f'Video provider API error {response.status_code}: {detail}') from exc

    def generate_video_direct(self, payload: dict[str, Any]) -> dict[str, Any]:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(self._url('/v2/video/generate'), headers=self.headers, json=payload)
        self._raise_for_status(response)
        return response.json()

    def generate_video_from_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(self._url(f'/v2/template/{template_id}/generate'), headers=self.headers, json=payload)
        self._raise_for_status(response)
        return response.json()

    def get_video_status(self, video_id: str) -> dict[str, Any]:
        params = {'video_id': video_id}
        with httpx.Client(timeout=60.0) as client:
            response = client.get(self._url('/v1/video_status.get'), headers=self.headers, params=params)
        self._raise_for_status(response)
        return response.json()

    def list_avatars(self) -> dict[str, Any]:
        with httpx.Client(timeout=60.0) as client:
            response = client.get(self._url('/v2/avatars'), headers=self.headers)
        self._raise_for_status(response)
        return response.json()

    def list_talking_photos(self) -> dict[str, Any]:
        with httpx.Client(timeout=60.0) as client:
            response = client.get(self._url('/v2/talking_photos'), headers=self.headers)
        self._raise_for_status(response)
        return response.json()

    def list_voices(self) -> dict[str, Any]:
        with httpx.Client(timeout=60.0) as client:
            response = client.get(self._url('/v2/voices'), headers=self.headers)
        self._raise_for_status(response)
        return response.json()

    def list_templates(self) -> dict[str, Any]:
        with httpx.Client(timeout=60.0) as client:
            response = client.get(self._url('/v2/templates'), headers=self.headers)
        self._raise_for_status(response)
        return response.json()

    def get_template_details(self, template_id: str, version: str = 'v3') -> dict[str, Any]:
        path = f'/v3/template/{template_id}' if version == 'v3' else f'/v2/template/{template_id}'
        with httpx.Client(timeout=60.0) as client:
            response = client.get(self._url(path), headers=self.headers)
        self._raise_for_status(response)
        return response.json()

    def wait_for_video(self, video_id: str, *, timeout_seconds: int | None = None, interval_seconds: int | None = None) -> dict[str, Any]:
        timeout = timeout_seconds or settings.poll_timeout_seconds
        interval = interval_seconds or settings.poll_interval_seconds
        deadline = time.time() + timeout

        while time.time() < deadline:
            status = self.get_video_status(video_id)
            state = str(status.get('status') or status.get('data', {}).get('status') or '').lower()
            if state in {'completed', 'done', 'success'}:
                return status
            if state in {'failed', 'error'}:
                raise RuntimeError(self.summarize_provider_error(status))
            time.sleep(interval)
        raise TimeoutError(f'Video {video_id} did not finish within {timeout} seconds')

    def download_file(self, url: str, target_path: Path) -> Path:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with httpx.stream('GET', url, timeout=120.0) as response:
            self._raise_for_status(response)
            with target_path.open('wb') as handle:
                for chunk in response.iter_bytes():
                    handle.write(chunk)
        return target_path

    def generate_tts(self, voice_id: str, text: str) -> dict[str, Any]:
        payload = {
            "voice_id": voice_id,
            "input_text": text
        }
        with httpx.Client(timeout=60.0) as client:
            response = client.post(self._url('/v2/video/text_to_speech'), headers=self.headers, json=payload)
        self._raise_for_status(response)
        return response.json()
