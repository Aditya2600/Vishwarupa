from __future__ import annotations

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
    def _normalize_error_text(raw_text: str | None) -> str | None:
        normalized = ' '.join((raw_text or '').split()).strip()
        if not normalized:
            return None
        if normalized.lower() in {'success', 'ok'}:
            return None
        # Keep logs readable even when providers return verbose payload snippets.
        return normalized[:300]

    @staticmethod
    def _friendly_provider_message(raw_message: str | None) -> str | None:
        normalized = HeyGenClient._normalize_error_text(raw_message)
        if not normalized:
            return None

        lowered = normalized.lower()
        if 'insufficient credit' in lowered:
            return "You don't have enough credits to generate this video."
        if 'voice is not available' in lowered or 'voice not available' in lowered or 'voice unavailable' in lowered:
            return 'The selected voice is unavailable right now. Please choose another voice and try again.'
        if 'timed out' in lowered or 'timeout' in lowered:
            return 'Video generation is taking longer than expected. Please try again shortly.'
        return None

    @staticmethod
    def summarize_provider_error(payload: dict[str, Any] | str) -> str:
        default_message = 'Video generation failed. Please try again in a moment.'

        if isinstance(payload, str):
            return (
                HeyGenClient._friendly_provider_message(payload)
                or HeyGenClient._normalize_error_text(payload)
                or default_message
            )

        data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
        nested_error = data.get('error')
        root_error = payload.get('error')
        error = nested_error if isinstance(nested_error, dict) else (root_error if isinstance(root_error, dict) else {})

        code = str(error.get('code') or '').strip()
        detail = HeyGenClient._normalize_error_text(str(error.get('detail') or payload.get('detail') or ''))
        message = HeyGenClient._normalize_error_text(
            str(error.get('message') or payload.get('message') or data.get('message') or '')
        )
        error_text = HeyGenClient._normalize_error_text(
            str(nested_error if isinstance(nested_error, str) else root_error if isinstance(root_error, str) else '')
        )

        lowered_detail = detail.lower() if detail else ''
        lowered_message = message.lower() if message else ''
        if (
            code == 'MOVIO_PAYMENT_INSUFFICIENT_CREDIT'
            or 'insufficient credit' in lowered_detail
            or 'insufficient credit' in lowered_message
        ):
            return "You don't have enough credits to generate this video."

        fallback: str | None = None
        for candidate in (detail, message, error_text):
            if not candidate:
                continue
            friendly = HeyGenClient._friendly_provider_message(candidate)
            if friendly:
                return friendly
            if not fallback:
                fallback = candidate

        if fallback:
            normalized_code = code.strip()
            if normalized_code and normalized_code.lower() not in {'success', 'ok'}:
                return f'{fallback} (code: {normalized_code})'
            return fallback

        if code and code.lower() not in {'success', 'ok'}:
            return f'Provider request failed with code: {code}'

        return default_message

    def _raise_for_status(self, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                payload: dict[str, Any] | str = response.json()
            except Exception:
                payload = response.text
            raise RuntimeError(self.summarize_provider_error(payload)) from exc

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
