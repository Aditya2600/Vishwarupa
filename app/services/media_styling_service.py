from __future__ import annotations

import hashlib
import json
import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import httpx

from app.config import settings
from app.services.heygen_client import HeyGenClient


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SubtitleCue:
    start_seconds: float
    end_seconds: float
    text: str


@dataclass(frozen=True)
class StyleRequest:
    include_captions: bool
    subtitle_color: str
    subtitle_position: str
    transcript: str | None
    logo_position: str
    logo_opacity: int
    logo_filename: str | None = None
    logo_bytes: bytes | None = None


@dataclass(frozen=True)
class StyledArtifact:
    video_id: str
    source_video_url: str
    source_video_path: Path
    final_video_path: Path
    subtitle_file_path: Path | None
    logo_file_path: Path | None
    subtitle_source: Literal['provider', 'transcript', 'disabled']


@dataclass(frozen=True)
class VideoGeometry:
    width: int
    height: int
    duration_seconds: float


@dataclass(frozen=True)
class SubtitleOverlay:
    image_path: Path
    start_seconds: float
    end_seconds: float


class MediaStylingService:
    _subtitle_colors = {
        'white': (255, 255, 255),
        'blue': (96, 165, 250),
        'green': (52, 211, 153),
        'red': (248, 113, 113),
        'yellow': (255, 238, 112),
        'black': (0, 0, 0),
    }
    _subtitle_alignments = {
        'top': 8,
        'center': 5,
        'bottom': 2,
    }
    _logo_positions = {
        'top left': ('32', '32'),
        'top right': ('main_w-overlay_w-32', '32'),
        'bottom left': ('32', 'main_h-overlay_h-32'),
        'bottom right': ('main_w-overlay_w-32', 'main_h-overlay_h-32'),
    }
    _allowed_logo_suffixes = {'.png', '.jpg', '.jpeg'}
    _max_logo_bytes = 2 * 1024 * 1024
    _subtitle_font_candidates = (
        '/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc',
        '/System/Library/Fonts/Supplemental/ITFDevanagari.ttc',
        '/System/Library/Fonts/Supplemental/DevanagariMT.ttc',
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        'C:\\Windows\\Fonts\\Nirmala.ttf',
        'C:\\Windows\\Fonts\\Mangal.ttf',
        'C:\\Windows\\Fonts\\arialuni.ttf',
    )

    def __init__(self, client: HeyGenClient | None = None) -> None:
        self.client = client or HeyGenClient()
        (settings.output_dir / 'avatar-videos').mkdir(parents=True, exist_ok=True)

    def ensure_ffmpeg_available(self) -> None:
        try:
            subprocess.run(
                [settings.ffmpeg_binary, '-version'],
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as exc:
            raise RuntimeError(f'FFmpeg is not available. Configure FFMPEG_BINARY or install `{settings.ffmpeg_binary}`.') from exc
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.strip() if exc.stderr else ''
            raise RuntimeError(f'FFmpeg is installed but not usable: {stderr or exc}') from exc

    def style_video(self, video_id: str, style_request: StyleRequest) -> StyledArtifact:
        normalized = self._normalize_style_request(style_request)
        logger.info('video_styling_requested', extra={'video_id': video_id, 'include_captions': normalized.include_captions, 'has_logo': bool(normalized.logo_bytes)})

        self.ensure_ffmpeg_available()
        status_response = self.client.get_video_status(video_id)
        current_status = self._extract_status(status_response)
        if current_status not in {'completed', 'done', 'success'}:
            raise RuntimeError(f'Video {video_id} is not ready for styling. Current status: {current_status}')

        source_video_url = self._extract_source_video_url(status_response)
        caption_url = self._extract_caption_url(status_response)
        style_key = self._style_key(video_id, normalized, caption_url)

        artifact_root = settings.output_dir / 'avatar-videos' / video_id
        style_dir = artifact_root / style_key
        artifact_root.mkdir(parents=True, exist_ok=True)
        style_dir.mkdir(parents=True, exist_ok=True)

        source_video_path = artifact_root / 'source.mp4'
        if not source_video_path.exists():
            logger.info('video_styling_source_download_started', extra={'video_id': video_id, 'source_video_path': str(source_video_path)})
            self.client.download_file(source_video_url, source_video_path)
            logger.info('video_styling_source_download_completed', extra={'video_id': video_id, 'source_video_path': str(source_video_path)})

        logo_file_path = self._persist_logo(style_dir, normalized.logo_filename, normalized.logo_bytes)
        subtitle_file_path: Path | None = None
        subtitle_source: Literal['provider', 'transcript', 'disabled'] = 'disabled'
        subtitle_overlays: list[SubtitleOverlay] = []
        video_geometry = self._probe_video_geometry(source_video_path)

        if normalized.include_captions:
            cues: list[SubtitleCue] = []
            if caption_url:
                try:
                    caption_text = self._download_text(caption_url)
                    cues = self._parse_caption_text(caption_text)
                    subtitle_source = 'provider'
                except Exception as exc:
                    logger.warning('video_styling_caption_download_failed', extra={'video_id': video_id, 'error': str(exc)})

            if not cues:
                if not normalized.transcript:
                    raise RuntimeError('Captions were requested, but no caption file or transcript is available.')
                cues = self._build_transcript_cues(normalized.transcript, video_geometry.duration_seconds)
                subtitle_source = 'transcript'

            subtitle_file_path = style_dir / 'captions'
            subtitle_file_path.mkdir(parents=True, exist_ok=True)
            subtitle_overlays = self._render_subtitle_overlays(
                output_dir=subtitle_file_path,
                cues=cues,
                color=normalized.subtitle_color,
                position=normalized.subtitle_position,
                width=video_geometry.width,
                height=video_geometry.height,
            )
            logger.info('video_styling_subtitles_ready', extra={'video_id': video_id, 'subtitle_file_path': str(subtitle_file_path), 'subtitle_source': subtitle_source})

        final_video_path = style_dir / 'final.mp4'
        if final_video_path.exists():
            logger.info('video_styling_cache_hit', extra={'video_id': video_id, 'final_video_path': str(final_video_path)})
            return StyledArtifact(
                video_id=video_id,
                source_video_url=source_video_url,
                source_video_path=source_video_path,
                final_video_path=final_video_path,
                subtitle_file_path=subtitle_file_path,
                logo_file_path=logo_file_path,
                subtitle_source=subtitle_source,
            )

        logger.info('video_styling_ffmpeg_started', extra={'video_id': video_id, 'final_video_path': str(final_video_path)})
        self._run_ffmpeg(
            source_video_path=source_video_path,
            final_video_path=final_video_path,
            subtitle_overlays=subtitle_overlays,
            logo_file_path=logo_file_path,
            logo_position=normalized.logo_position,
            logo_opacity=normalized.logo_opacity,
        )
        logger.info('video_styling_ffmpeg_completed', extra={'video_id': video_id, 'final_video_path': str(final_video_path)})

        return StyledArtifact(
            video_id=video_id,
            source_video_url=source_video_url,
            source_video_path=source_video_path,
            final_video_path=final_video_path,
            subtitle_file_path=subtitle_file_path,
            logo_file_path=logo_file_path,
            subtitle_source=subtitle_source,
        )

    def _normalize_style_request(self, request: StyleRequest) -> StyleRequest:
        transcript = ' '.join((request.transcript or '').split()) or None
        subtitle_color = self._normalize_subtitle_color(request.subtitle_color)
        subtitle_position = self._normalize_subtitle_position(request.subtitle_position)
        logo_position = self._normalize_logo_position(request.logo_position)
        logo_opacity = int(request.logo_opacity)
        if not 0 <= logo_opacity <= 100:
            raise ValueError('Logo opacity must be between 0 and 100.')
        if not request.include_captions and not request.logo_bytes:
            raise ValueError('Provide captions and/or a logo to create a styled output.')
        return StyleRequest(
            include_captions=request.include_captions,
            subtitle_color=subtitle_color,
            subtitle_position=subtitle_position,
            transcript=transcript,
            logo_position=logo_position,
            logo_opacity=logo_opacity,
            logo_filename=request.logo_filename,
            logo_bytes=request.logo_bytes,
        )

    def _normalize_subtitle_color(self, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in self._subtitle_colors:
            raise ValueError(f'Unsupported subtitle color: {value}')
        return cleaned

    def _normalize_subtitle_position(self, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in self._subtitle_alignments:
            raise ValueError(f'Unsupported subtitle position: {value}')
        return cleaned

    def _normalize_logo_position(self, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in self._logo_positions:
            raise ValueError(f'Unsupported logo position: {value}')
        return cleaned

    def _extract_status(self, payload: dict) -> str:
        data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
        return str(payload.get('status') or data.get('status') or 'submitted').lower()

    def _extract_source_video_url(self, payload: dict) -> str:
        data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
        video_url = data.get('video_url') or payload.get('video_url') or data.get('video_url_with_watermark')
        if not video_url:
            raise RuntimeError('The completed video does not include a downloadable video URL.')
        return str(video_url)

    def _extract_caption_url(self, payload: dict) -> str | None:
        data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
        caption_url = data.get('caption_url') or payload.get('caption_url')
        return str(caption_url) if caption_url else None

    def _style_key(self, video_id: str, style_request: StyleRequest, caption_url: str | None) -> str:
        logo_hash = hashlib.sha256(style_request.logo_bytes).hexdigest() if style_request.logo_bytes else None
        payload = {
            'video_id': video_id,
            'include_captions': style_request.include_captions,
            'subtitle_color': style_request.subtitle_color,
            'subtitle_position': style_request.subtitle_position,
            'transcript': style_request.transcript or '',
            'logo_position': style_request.logo_position,
            'logo_opacity': style_request.logo_opacity,
            'logo_hash': logo_hash,
            'caption_url': caption_url or '',
        }
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()
        return digest[:12]

    def _persist_logo(self, style_dir: Path, filename: str | None, logo_bytes: bytes | None) -> Path | None:
        if not logo_bytes:
            return None
        if len(logo_bytes) > self._max_logo_bytes:
            raise ValueError('Logo upload exceeds the 2MB limit.')

        suffix = Path(filename or 'logo.png').suffix.lower() or '.png'
        if suffix not in self._allowed_logo_suffixes:
            raise ValueError('Logo must be a PNG or JPG image.')

        logo_path = style_dir / f'logo{suffix}'
        if not logo_path.exists():
            logo_path.write_bytes(logo_bytes)
        return logo_path

    def _download_text(self, url: str) -> str:
        response = httpx.get(url, timeout=120.0)
        response.raise_for_status()
        return response.text

    def _parse_caption_text(self, text: str) -> list[SubtitleCue]:
        cleaned = text.replace('\r\n', '\n').replace('\r', '\n').strip()
        if cleaned.startswith('WEBVTT'):
            cleaned = cleaned.split('\n', 1)[1].strip()

        cues: list[SubtitleCue] = []
        for block in re.split(r'\n\s*\n', cleaned):
            lines: list[str] = []
            for line in block.split('\n'):
                cleaned_line = line.strip()
                if cleaned_line:
                    lines.append(cleaned_line)
            if not lines:
                continue
            if '-->' not in lines[0] and len(lines) > 1 and '-->' in lines[1]:
                lines = lines[1:]
            if '-->' not in lines[0]:
                continue

            start_raw, end_raw = [part.strip().split(' ', 1)[0] for part in lines[0].split('-->', 1)]
            content = ' '.join(lines[1:])
            if not content:
                continue
            cues.append(
                SubtitleCue(
                    start_seconds=self._parse_timestamp(start_raw),
                    end_seconds=self._parse_timestamp(end_raw),
                    text=' '.join(content.split()),
                )
            )
        return cues

    def _parse_timestamp(self, value: str) -> float:
        normalized = value.strip().replace(',', '.')
        parts = normalized.split(':')
        if len(parts) != 3:
            raise ValueError(f'Unsupported timestamp: {value}')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return (hours * 3600) + (minutes * 60) + seconds

    def _probe_video_geometry(self, video_path: Path) -> VideoGeometry:
        try:
            probe = subprocess.run(
                [settings.ffmpeg_binary, '-i', str(video_path)],
                check=False,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as exc:
            raise RuntimeError(f'FFmpeg is not available. Configure FFMPEG_BINARY or install `{settings.ffmpeg_binary}`.') from exc

        match = re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)', probe.stderr)
        if not match:
            raise RuntimeError(f'Unable to determine video duration for {video_path}.')
        hours, minutes, seconds = match.groups()
        size_match = re.search(r'Video:.*?(\d{2,5})x(\d{2,5})', probe.stderr)
        if not size_match:
            raise RuntimeError(f'Unable to determine video dimensions for {video_path}.')
        width, height = size_match.groups()
        return VideoGeometry(
            width=int(width),
            height=int(height),
            duration_seconds=(int(hours) * 3600) + (int(minutes) * 60) + float(seconds),
        )

    def _build_transcript_cues(self, transcript: str, duration_seconds: float) -> list[SubtitleCue]:
        sentences: list[str] = []
        for chunk in re.split(r'(?<=[.!?।])\s+', transcript):
            cleaned_chunk = chunk.strip()
            if cleaned_chunk:
                sentences.append(cleaned_chunk)
        chunks: list[str] = []
        for sentence in sentences or [transcript]:
            words = sentence.split()
            if len(words) <= 10:
                chunks.append(sentence)
                continue
            for index in range(0, len(words), 10):
                chunks.append(' '.join(words[index:index + 10]))

        if not chunks:
            chunks = [transcript]

        minimum_duration = max(4.0, min(duration_seconds, len(chunks) * 2.0))
        effective_duration = max(duration_seconds, minimum_duration)
        weights = [max(1, len(chunk.split())) for chunk in chunks]
        total_weight = sum(weights)

        cues: list[SubtitleCue] = []
        cursor = 0.0
        for index, chunk in enumerate(chunks):
            duration = effective_duration * (weights[index] / total_weight)
            end = effective_duration if index == len(chunks) - 1 else min(effective_duration, cursor + duration)
            cues.append(SubtitleCue(start_seconds=cursor, end_seconds=max(cursor + 0.8, end), text=chunk))
            cursor = end
        return cues

    def _render_subtitle_overlays(
        self,
        *,
        output_dir: Path,
        cues: list[SubtitleCue],
        color: str,
        position: str,
        width: int,
        height: int,
    ) -> list[SubtitleOverlay]:
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ModuleNotFoundError as exc:
            raise RuntimeError('Subtitle styling requires Pillow. Run `pip install -r requirements.txt` and retry.') from exc

        output_dir.mkdir(parents=True, exist_ok=True)
        font_path = self._resolve_subtitle_font_path()
        font_size = max(30, min(56, int(width * 0.034)))
        font = ImageFont.truetype(font_path, font_size)
        stroke_width = max(1, font_size // 14)
        overlays: list[SubtitleOverlay] = []
        vertical_margin = max(48, int(height * 0.08))

        for index, cue in enumerate(cues):
            lines = self._wrap_subtitle_text(cue.text, font=font, max_width=int(width * 0.78))
            line_gap = max(8, font_size // 4)
            temp_image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(temp_image)
            line_heights: list[int] = []
            line_widths: list[int] = []
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font, stroke_width=stroke_width)
                line_widths.append(bbox[2] - bbox[0])
                line_heights.append(bbox[3] - bbox[1])

            text_block_width = max(line_widths, default=0)
            text_block_height = sum(line_heights) + line_gap * max(0, len(lines) - 1)
            padding_x = max(28, font_size)
            padding_y = max(18, font_size // 2)
            box_width = min(width - 64, text_block_width + padding_x * 2)
            box_height = text_block_height + padding_y * 2
            x = (width - box_width) // 2
            if position == 'top':
                y = vertical_margin
            elif position == 'center':
                y = (height - box_height) // 2
            else:
                y = height - box_height - vertical_margin

            draw.rounded_rectangle(
                (x, y, x + box_width, y + box_height),
                radius=max(18, font_size // 2),
                fill=(12, 10, 24, 132),
            )

            current_y = y + padding_y
            rgb = self._subtitle_color_rgb(color)
            for line_index, line in enumerate(lines):
                line_width = line_widths[line_index]
                line_x = (width - line_width) // 2
                draw.text(
                    (line_x, current_y),
                    line,
                    font=font,
                    fill=rgb + (255,),
                    stroke_width=stroke_width,
                    stroke_fill=(0, 0, 0, 220),
                )
                current_y += line_heights[line_index] + line_gap

            image_path = output_dir / f'cue_{index:03d}.png'
            temp_image.save(image_path)
            overlays.append(
                SubtitleOverlay(
                    image_path=image_path,
                    start_seconds=cue.start_seconds,
                    end_seconds=cue.end_seconds,
                )
            )
        return overlays

    def _resolve_subtitle_font_path(self) -> str:
        candidates = []
        if settings.subtitle_font_path:
            candidates.append(settings.subtitle_font_path)
        candidates.extend(self._subtitle_font_candidates)
        for candidate in candidates:
            if candidate and Path(candidate).exists():
                return candidate
        raise RuntimeError('No Devanagari-capable subtitle font was found. Set SUBTITLE_FONT_PATH in `.env` to a valid TTF/TTC file.')

    def _wrap_subtitle_text(self, text: str, *, font, max_width: int) -> list[str]:
        from PIL import Image, ImageDraw

        words = text.split()
        if not words:
            return ['']

        draw = ImageDraw.Draw(Image.new('RGBA', (10, 10), (0, 0, 0, 0)))
        lines: list[str] = []
        current = words[0]
        for word in words[1:]:
            candidate = f'{current} {word}'
            bbox = draw.textbbox((0, 0), candidate, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
        return lines

    def _subtitle_color_rgb(self, color: str) -> tuple[int, int, int]:
        return self._subtitle_colors.get(color, self._subtitle_colors['white'])

    def _run_ffmpeg(
        self,
        *,
        source_video_path: Path,
        final_video_path: Path,
        subtitle_overlays: list[SubtitleOverlay],
        logo_file_path: Path | None,
        logo_position: str,
        logo_opacity: int,
    ) -> None:
        command = self.build_ffmpeg_command(
            source_video_path=source_video_path,
            final_video_path=final_video_path,
            subtitle_overlays=subtitle_overlays,
            logo_file_path=logo_file_path,
            logo_position=logo_position,
            logo_opacity=logo_opacity,
        )
        logger.info('ffmpeg_command_built', extra={'video_id': str(source_video_path.parent.name), 'command': ' '.join(command)})
        final_video_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.strip() if exc.stderr else ''
            raise RuntimeError(f'FFmpeg styling failed: {stderr or exc}') from exc

    def build_ffmpeg_command(
        self,
        *,
        source_video_path: Path,
        final_video_path: Path,
        subtitle_overlays: list[SubtitleOverlay],
        logo_file_path: Path | None,
        logo_position: str,
        logo_opacity: int,
    ) -> list[str]:
        command = [settings.ffmpeg_binary, '-y', '-i', str(source_video_path)]
        filter_parts: list[str] = []
        output_label = 'base'
        last_label = 'base'
        filter_parts.append('[0:v]format=rgba[base]')

        for index, overlay in enumerate(subtitle_overlays, start=1):
            command.extend(['-loop', '1', '-i', str(overlay.image_path)])
            next_label = f'sub{index}'
            filter_parts.append(
                f'[{last_label}][{index}:v]overlay=0:0:enable=\'between(t,{overlay.start_seconds:.2f},{overlay.end_seconds:.2f})\'[{next_label}]'
            )
            last_label = next_label
            output_label = next_label

        if logo_file_path:
            logo_index = len(subtitle_overlays) + 1
            command.extend(['-i', str(logo_file_path)])
            # Scale logo to max width 220, maintain aspect ratio
            logo_filter = f'[{logo_index}:v]scale=220:-2,format=rgba,colorchannelmixer=aa={logo_opacity / 100:.2f}[logo]'
            filter_parts.append(logo_filter)
            
            # Use lowercase for dictionary lookup to match "top left", etc.
            lookup_pos = logo_position.lower()
            x_pos, y_pos = self._logo_positions.get(lookup_pos, self._logo_positions['top right'])
            filter_parts.append(f'[{last_label}][logo]overlay={x_pos}:{y_pos}[styled]')
            output_label = 'styled'

        if filter_parts:
            command.extend(['-filter_complex', ';'.join(filter_parts), '-map', f'[{output_label}]'])
        else:
            command.extend(['-map', '0:v:0'])

        command.extend(
            [
                '-map',
                '0:a?',
                '-c:v',
                'libx264',
                '-preset',
                'medium',
                '-crf',
                '23',
                '-pix_fmt',
                'yuv420p',
                '-c:a',
                'aac',
                '-movflags',
                '+faststart',
                '-shortest',
                str(final_video_path),
            ]
        )
        return command
