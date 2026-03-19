from __future__ import annotations

import json
import time
from copy import deepcopy
from pathlib import Path
from typing import Any, Literal

from app.config import settings
from app.models import DirectVideoRequest, TemplateVideoRequest, VideoJobResult
from app.services.heygen_client import HeyGenClient
from app.services.script_renderer import build_context, render_inline_template, render_template
from app.utils.text_utils import normalize_hindi_numbers
from app.utils.validation import require_non_null


class VideoService:
    VOICE_CACHE_TTL_SECONDS = 300

    def __init__(self, client: HeyGenClient | None = None) -> None:
        self.client = client or HeyGenClient()
        self._voice_cache: list[dict[str, Any]] | None = None
        self._voice_cache_ts: float = 0.0
        settings.output_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _extract_video_id(response: dict[str, Any]) -> str:
        candidates = [
            response.get('video_id'),
            response.get('id'),
            response.get('data', {}).get('video_id') if isinstance(response.get('data'), dict) else None,
            response.get('data', {}).get('id') if isinstance(response.get('data'), dict) else None,
        ]
        for candidate in candidates:
            if candidate:
                return str(candidate)
        raise RuntimeError(f'Unable to find video_id in response: {response}')

    @staticmethod
    def _extract_video_url(status_response: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
        data = status_response.get('data') if isinstance(status_response.get('data'), dict) else {}
        video_url = data.get('video_url') or status_response.get('video_url') or data.get('video_url_with_watermark')
        thumbnail_url = data.get('thumbnail_url') or status_response.get('thumbnail_url')
        title = data.get('title') or status_response.get('title')
        return video_url, thumbnail_url, title

    @staticmethod
    def _parse_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return value.strip().lower() in {'1', 'true', 'yes', 'on'}
        return bool(value)

    @staticmethod
    def _extract_voice_id(voice: dict[str, Any]) -> str | None:
        for key in ('voice_id', 'id', 'voiceId'):
            value = voice.get(key)
            if value:
                return str(value)
        return None

    @staticmethod
    def _extract_voice_gender(voice: dict[str, Any]) -> str | None:
        for key in ('gender', 'sex', 'speaker_gender'):
            value = voice.get(key)
            if value:
                lowered = str(value).strip().lower()
                if lowered in {'male', 'female'}:
                    return lowered
        return None

    @staticmethod
    def _is_voice_available(voice: dict[str, Any]) -> bool:
        for bool_key, unavailable_value in (
            ('is_available', False),
            ('available', False),
            ('enabled', False),
            ('is_enabled', False),
            ('disabled', True),
            ('is_disabled', True),
        ):
            if bool_key in voice and VideoService._parse_bool(voice.get(bool_key)) == unavailable_value:
                return False

        status_value = voice.get('status') or voice.get('voice_status') or voice.get('state')
        status = str(status_value or '').strip().lower()
        if not status:
            return True
        if status in {'failed', 'error', 'inactive', 'disabled', 'unavailable', 'deleted'}:
            return False
        return all(fragment not in status for fragment in ('fail', 'error', 'inactive', 'disabled', 'unavailable'))

    def _get_available_voices(self) -> list[dict[str, Any]]:
        list_voices = getattr(self.client, 'list_voices', None)
        if not callable(list_voices):
            return []

        now = time.time()
        if self._voice_cache is not None and (now - self._voice_cache_ts) < self.VOICE_CACHE_TTL_SECONDS:
            return self._voice_cache

        try:
            response = list_voices()
        except Exception:
            return self._voice_cache or []

        voices_root = response.get('data') if isinstance(response, dict) else {}
        voices = voices_root.get('voices') if isinstance(voices_root, dict) else None
        if not isinstance(voices, list):
            voices = []

        parsed_voices = [voice for voice in voices if isinstance(voice, dict)]
        self._voice_cache = parsed_voices
        self._voice_cache_ts = now
        return parsed_voices

    def _resolve_voice_id(self, requested_voice_id: str | None, *, preferred_gender: str | None) -> str | None:
        initial_candidate = (requested_voice_id or settings.heygen_voice_id or '').strip() or None
        if not initial_candidate:
            return None

        voices = self._get_available_voices()
        if not voices:
            return initial_candidate

        voice_by_id = {
            voice_id: voice
            for voice in voices
            for voice_id in [self._extract_voice_id(voice)]
            if voice_id
        }
        available_voices = [voice for voice in voices if self._is_voice_available(voice)]

        current = voice_by_id.get(initial_candidate)
        if current and self._is_voice_available(current):
            return initial_candidate
        # If the selected voice is missing or unavailable, prefer a same-gender replacement.
        if not preferred_gender and current:
            preferred_gender = self._extract_voice_gender(current)

        normalized_gender = (preferred_gender or '').strip().lower()
        if normalized_gender in {'male', 'female'}:
            for voice in available_voices:
                if self._extract_voice_gender(voice) == normalized_gender:
                    replacement_id = self._extract_voice_id(voice)
                    if replacement_id:
                        return replacement_id

        for voice in available_voices:
            replacement_id = self._extract_voice_id(voice)
            if replacement_id:
                return replacement_id

        return None

    def _build_direct_payload(self, request: DirectVideoRequest) -> dict[str, Any]:
        avatar_id = request.avatar_id or settings.heygen_avatar_id
        require_non_null(avatar_id, field_name='avatar_id')

        script_text = render_inline_template(request.script_text, request) if request.script_text else render_template(request.template_name, request)
        background_color = request.background_color or settings.default_background_color
        width = request.video_width or settings.default_video_width
        height = request.video_height or settings.default_video_height
        voice_id = self._resolve_voice_id(request.voice_id, preferred_gender=request.voice_gender)

        if request.language == "Hindi":
            script_text = normalize_hindi_numbers(script_text)

        # The provider's direct generate endpoint validates text voices under voice.text.*.
        # Keep the top-level fields too for backward compatibility with older payload variants.
        voice_text: dict[str, Any] = {
            'input_text': script_text,
        }
        if voice_id:
            voice_text['voice_id'] = voice_id

        voice_block: dict[str, Any] = {
            'type': 'text',
            'text': voice_text,
            'input_text': script_text,
        }
        if voice_id:
            voice_block['voice_id'] = voice_id

        scene = {
            'character': {
                'type': 'avatar',
                'avatar_id': avatar_id,
                'avatar_style': 'normal',
            },
            'voice': voice_block,
            'background': {
                'type': 'color',
                'value': background_color,
            },
        }

        payload: dict[str, Any] = {
            'caption': request.include_captions,
            'dimension': {
                'width': width,
                'height': height,
            },
            'title': f"{request.title_prefix} - {request.customer_name} - {request.lan}",
            'video_inputs': [scene],
        }
        if request.folder:
            payload['folder_id'] = request.folder
        return payload

    @staticmethod
    def _is_voice_unavailable_error(error: Exception | str) -> bool:
        lowered = str(error).lower()
        return (
            'voice is not available' in lowered
            or 'voice not available' in lowered
            or 'voice unavailable' in lowered
            or 'selected voice is unavailable' in lowered
        )

    @staticmethod
    def _drop_voice_id(payload: dict[str, Any]) -> dict[str, Any]:
        fallback_payload = deepcopy(payload)
        inputs = fallback_payload.get('video_inputs')
        if isinstance(inputs, list) and inputs:
            first_input = inputs[0] if isinstance(inputs[0], dict) else None
            if first_input:
                voice_block = first_input.get('voice') if isinstance(first_input.get('voice'), dict) else None
                if voice_block:
                    voice_block.pop('voice_id', None)
                    text_block = voice_block.get('text') if isinstance(voice_block.get('text'), dict) else None
                    if text_block:
                        text_block.pop('voice_id', None)
        return fallback_payload

    def _build_template_payload(self, request: TemplateVideoRequest) -> tuple[str, dict[str, Any]]:
        template_id = request.template_id or settings.heygen_template_id
        require_non_null(template_id, field_name='template_id')

        payload_path = Path(request.payload_path or settings.heygen_template_payload_path)
        raw = payload_path.read_text(encoding='utf-8')
        context = build_context(request)
        # simple placeholder replace without introducing another templating syntax dependency
        for key, value in context.items():
            raw = raw.replace('{{' + key + '}}', '' if value is None else str(value))
        payload = json.loads(raw)
        return str(template_id), payload

    def _persist_result(self, subdir: str, filename_stem: str, metadata: dict[str, Any], video_url: str | None) -> Path | None:
        output_dir = settings.output_dir / subdir
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / f'{filename_stem}.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
        if video_url:
            return self.client.download_file(video_url, output_dir / f'{filename_stem}.mp4')
        return None

    def get_video_status_result(self, video_id: str, *, request_mode: Literal['direct', 'template'] = 'direct') -> VideoJobResult:
        status_response = self.client.get_video_status(video_id)
        status = str(status_response.get('status') or status_response.get('data', {}).get('status') or 'submitted')
        state = status.lower()
        if state in {'failed', 'error'}:
            raise RuntimeError(self.client.summarize_provider_error(status_response))

        video_url, thumbnail_url, title = self._extract_video_url(status_response)
        return VideoJobResult(
            request_mode=request_mode,
            video_id=video_id,
            status=status,
            video_url=video_url,
            thumbnail_url=thumbnail_url,
            title=title,
            raw_response=status_response,
            saved_to=None,
        )

    def generate_direct(self, request: DirectVideoRequest, *, wait: bool = True) -> VideoJobResult:
        create_payload = self._build_direct_payload(request)
        try:
            create_response = self.client.generate_video_direct(create_payload)
        except RuntimeError as exc:
            # Rare race: voice status can flip after we fetched the catalog.
            if not self._is_voice_unavailable_error(exc):
                raise
            retry_payload = self._drop_voice_id(create_payload)
            create_response = self.client.generate_video_direct(retry_payload)
        video_id = self._extract_video_id(create_response)
        final_response = self.client.wait_for_video(video_id) if wait else create_response
        status = str(final_response.get('status') or final_response.get('data', {}).get('status') or 'submitted')
        video_url, thumbnail_url, title = self._extract_video_url(final_response)
        saved = self._persist_result('direct', f'{request.lan}_{video_id}', final_response, video_url) if wait else None
        return VideoJobResult(
            request_mode='direct',
            video_id=video_id,
            status=status,
            video_url=video_url,
            thumbnail_url=thumbnail_url,
            title=title,
            raw_response=final_response,
            saved_to=saved,
        )

    def generate_from_template(self, request: TemplateVideoRequest, *, wait: bool = True) -> VideoJobResult:
        template_id, payload = self._build_template_payload(request)
        create_response = self.client.generate_video_from_template(template_id, payload)
        video_id = self._extract_video_id(create_response)
        final_response = self.client.wait_for_video(video_id) if wait else create_response
        status = str(final_response.get('status') or final_response.get('data', {}).get('status') or 'submitted')
        video_url, thumbnail_url, title = self._extract_video_url(final_response)
        saved = self._persist_result('template', f'{request.lan}_{video_id}', final_response, video_url) if wait else None
        return VideoJobResult(
            request_mode='template',
            video_id=video_id,
            status=status,
            video_url=video_url,
            thumbnail_url=thumbnail_url,
            title=title,
            raw_response=final_response,
            saved_to=saved,
        )
