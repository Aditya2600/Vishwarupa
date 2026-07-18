from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any

try:
    from app.config import settings
except ModuleNotFoundError as exc:
    if exc.name not in {"pydantic", "pydantic_settings"}:
        raise

    class _LocalHybridSettings:
        project_root = Path(__file__).resolve().parents[2]
        ffmpeg_binary = os.environ.get("FFMPEG_BINARY", "ffmpeg")
        remotion_npx_binary = os.environ.get("REMOTION_NPX_BINARY", "npx")
        remotion_browser_executable = os.environ.get("REMOTION_BROWSER_EXECUTABLE") or None

        @property
        def output_dir(self) -> Path:
            raw = os.environ.get("DEFAULT_OUTPUT_DIR", "output")
            path = Path(raw)
            return path if path.is_absolute() else self.project_root / path

        @property
        def remotion_path(self) -> Path:
            raw = os.environ.get("REMOTION_DIR", "Remotion")
            path = Path(raw)
            return path if path.is_absolute() else self.project_root / path

    settings = _LocalHybridSettings()


FPS = 30

ASPECT_CONFIG = {
    "landscape_16_9": {
        "composition": "HybridCollectionNoticeLandscape",
        "width": 1920,
        "height": 1080,
    },
    "portrait_9_16": {
        "composition": "HybridCollectionNoticePortrait",
        "width": 1080,
        "height": 1920,
    },
}


class HybridRenderError(RuntimeError):
    """Raised when local hybrid Remotion rendering cannot be completed."""


class HybridAvatarGenerationError(RuntimeError):
    """Raised when raw HeyGen avatar generation for hybrid rendering fails."""


def collection_status_percent(value: str | None) -> int:
    """Parse a collection-status string into an integer percent (0-100).

    Shared by the API endpoint (request validation) and the worker (job execution)
    so both interpret the field identically. Raises ValueError on out-of-range or
    non-numeric input.
    """
    if value is None or not value.strip():
        return 75

    match = re.search(r'\d+(?:\.\d+)?', value)
    if not match:
        raise ValueError('collection_status must contain a number between 0 and 100')

    parsed = round(float(match.group(0)))
    if not 0 <= parsed <= 100:
        raise ValueError('collection_status must be between 0 and 100')
    return parsed


def _project_path(path_value: str | Path) -> Path:
    path = Path(path_value).expanduser()
    return path if path.is_absolute() else settings.project_root / path


def _safe_video_id(video_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", str(video_id or "").strip())
    if not cleaned:
        raise ValueError("video_id must contain at least one safe filename character")
    return cleaned


def _ffprobe_binary() -> str:
    ffmpeg = Path(settings.ffmpeg_binary)
    if ffmpeg.name == "ffmpeg":
        candidate = ffmpeg.with_name("ffprobe")
        return str(candidate)
    return "ffprobe"


def _run_json_ffprobe(path: Path) -> dict[str, Any]:
    command = [
        _ffprobe_binary(),
        "-v",
        "error",
        "-show_entries",
        "format=duration,size",
        "-show_entries",
        "stream=index,codec_type,codec_name,width,height,duration",
        "-of",
        "json",
        str(path),
    ]
    result = subprocess.run(command, check=False, text=True, capture_output=True)
    if result.returncode != 0:
        raise HybridRenderError(
            f"ffprobe failed for {path}: {(result.stderr or result.stdout).strip()}"
        )
    try:
        return json.loads(result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise HybridRenderError(f"ffprobe returned invalid JSON for {path}") from exc


def _media_duration_seconds(probe: dict[str, Any]) -> float:
    raw_duration = (probe.get("format") or {}).get("duration")
    candidates = [raw_duration]
    for stream in probe.get("streams") or []:
        if isinstance(stream, dict):
            candidates.append(stream.get("duration"))

    for candidate in candidates:
        if candidate is not None:
            try:
                duration = float(candidate)
            except (TypeError, ValueError):
                continue
            if duration > 0:
                return duration

    raise HybridRenderError("media duration could not be determined or is zero")


def _has_stream(probe: dict[str, Any], codec_type: str) -> bool:
    return any(
        isinstance(stream, dict) and stream.get("codec_type") == codec_type
        for stream in probe.get("streams") or []
    )


def _verify_media(path: Path, *, require_audio: bool) -> dict[str, Any]:
    if not path.exists():
        raise HybridRenderError(f"Expected media file does not exist: {path}")
    if path.stat().st_size <= 0:
        raise HybridRenderError(f"Expected media file is empty: {path}")

    probe = _run_json_ffprobe(path)
    duration = _media_duration_seconds(probe)
    if not _has_stream(probe, "video"):
        raise HybridRenderError(f"Expected a video stream in {path}")
    if require_audio and not _has_stream(probe, "audio"):
        raise HybridRenderError(f"Expected an audio stream in {path}")

    return {
        "probe": probe,
        "duration_seconds": duration,
    }


def _language_name(language: str | None) -> str:
    normalized = (language or "hi").strip().lower()
    language_map = {
        "hi": "Hindi",
        "hindi": "Hindi",
        "en": "English",
        "eng": "English",
        "english": "English",
        "mr": "Marathi",
        "marathi": "Marathi",
        "ta": "Tamil",
        "tamil": "Tamil",
        "te": "Telugu",
        "telugu": "Telugu",
        "kn": "Kannada",
        "kannada": "Kannada",
        "bn": "Bengali",
        "bengali": "Bengali",
        "gu": "Gujarati",
        "gujarati": "Gujarati",
        "ml": "Malayalam",
        "malayalam": "Malayalam",
        "pa": "Punjabi",
        "punjabi": "Punjabi",
    }
    return language_map.get(normalized, language or "Hindi")


def _build_hybrid_avatar_script(
    *,
    customer_name: str,
    account_number: str,
    days_overdue: int,
    amount_due: str | None,
    agent_name: str,
    language: str,
) -> str:
    amount_text = amount_due or "the pending amount"
    if language == "Hindi":
        return (
            f"नमस्ते {customer_name} जी। मैं {agent_name}, कलेक्शंस टीम से बोल रही हूँ। "
            f"आपके खाते {account_number} पर भुगतान {days_overdue} दिनों से लंबित है। "
            f"कुल देय राशि {amount_text} है। कृपया आज ही भुगतान करें या सहायता के लिए हमारी टीम से संपर्क करें।"
        )

    return (
        f"Hello {customer_name}. I am {agent_name} from the collections team. "
        f"Your account {account_number} has been overdue for {days_overdue} days. "
        f"The amount due is {amount_text}. Please complete the payment today or contact our team for assistance."
    )


def _copy_intermediate_avatar(source_path: Path, destination_dir: Path, heygen_video_id: str) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{_safe_video_id(heygen_video_id)}.mp4"
    if source_path.resolve() != destination.resolve():
        shutil.copyfile(source_path, destination)
    return destination


def generate_raw_avatar_for_hybrid(
    customer_name: str,
    account_number: str,
    days_overdue: int,
    amount_due: str | None,
    avatar_id: str,
    voice_id: str,
    agent_name: str,
    language: str = "hi",
    output_dir: str | None = None,
) -> dict[str, Any]:
    try:
        from app.models import DirectVideoRequest
        from app.services.video_service import VideoService
    except Exception as exc:
        raise HybridAvatarGenerationError(
            "Could not load the existing avatar generation pipeline. "
            "Install backend dependencies and retry."
        ) from exc

    lang_name = _language_name(language)
    script_text = _build_hybrid_avatar_script(
        customer_name=customer_name,
        account_number=account_number,
        days_overdue=days_overdue,
        amount_due=amount_due,
        agent_name=agent_name,
        language=lang_name,
    )

    request = DirectVideoRequest(
        customer_name=customer_name,
        lan=account_number,
        client_name="Collections Team",
        tos=amount_due,
        avatar_id=avatar_id,
        voice_id=voice_id,
        language=lang_name,
        script_text=script_text,
        background_color="#F4F4F4",
        include_captions=False,
        title_prefix="Hybrid Raw Avatar",
        video_width=720,
        video_height=1280,
        voice_gender="female",
    )

    try:
        result = VideoService().generate_direct(request, wait=True)
    except TimeoutError as exc:
        raise HybridAvatarGenerationError(
            "HeyGen avatar generation timed out before the raw video was ready."
        ) from exc
    except RuntimeError as exc:
        message = str(exc).strip() or "HeyGen avatar generation failed."
        raise HybridAvatarGenerationError(message) from exc
    except Exception as exc:
        raise HybridAvatarGenerationError(
            f"Unexpected error while generating raw HeyGen avatar video: {exc}"
        ) from exc

    if not result.saved_to:
        raise HybridAvatarGenerationError("HeyGen completed, but no local avatar MP4 was downloaded.")

    saved_path = _project_path(result.saved_to)
    if output_dir:
        avatar_local_path = _copy_intermediate_avatar(
            saved_path,
            _project_path(output_dir),
            result.video_id,
        )
    else:
        avatar_local_path = saved_path

    media_meta = _verify_media(avatar_local_path, require_audio=True)
    probe = media_meta["probe"]

    return {
        "heygen_video_id": result.video_id,
        "avatar_local_path": str(avatar_local_path),
        "avatar_remote_url": result.video_url,
        "duration_seconds": media_meta["duration_seconds"],
        "has_video": _has_stream(probe, "video"),
        "has_audio": _has_stream(probe, "audio"),
    }


def _resolve_aspect_mode(
    aspect_mode: str,
    viewport_width: int | None,
    viewport_height: int | None,
) -> tuple[str, dict[str, Any]]:
    requested = (aspect_mode or "portrait_9_16").strip()
    if requested == "auto":
        if viewport_width is not None and viewport_height is not None and viewport_width >= viewport_height:
            resolved = "landscape_16_9"
        else:
            resolved = "portrait_9_16"
    else:
        resolved = requested

    config = ASPECT_CONFIG.get(resolved)
    if not config:
        valid = ", ".join(["auto", *ASPECT_CONFIG.keys()])
        raise ValueError(f"Unsupported aspect_mode '{aspect_mode}'. Expected one of: {valid}")

    return resolved, config


def _ensure_remotion_runtime_files(remotion_path: Path) -> None:
    leads_path = remotion_path / "leads.json"
    metadata_path = remotion_path / "public" / "metadata.json"

    if not leads_path.exists():
        leads_path.write_text("[]\n", encoding="utf-8")
    if not metadata_path.exists():
        metadata_path.parent.mkdir(parents=True, exist_ok=True)
        metadata_path.write_text("{}\n", encoding="utf-8")


def render_hybrid_avatar_pip_video(
    video_id: str,
    avatar_mp4_path: str,
    customer_name: str,
    account_number: str,
    days_overdue: int,
    collection_status: int,
    amount_due: str | None,
    agent_name: str,
    agent_role: str,
    aspect_mode: str,
    viewport_width: int | None = None,
    viewport_height: int | None = None,
    output_path: str | None = None,
) -> dict[str, Any]:
    safe_video_id = _safe_video_id(video_id)
    requested_aspect_mode = (aspect_mode or "portrait_9_16").strip()
    resolved_aspect_mode, aspect_config = _resolve_aspect_mode(
        requested_aspect_mode,
        viewport_width,
        viewport_height,
    )

    remotion_path = settings.remotion_path
    _ensure_remotion_runtime_files(remotion_path)

    source_avatar_path = _project_path(avatar_mp4_path)
    source_meta = _verify_media(source_avatar_path, require_audio=True)
    duration_seconds = source_meta["duration_seconds"]
    duration_frames = max(1, math.ceil(duration_seconds * FPS))

    remotion_avatar_dir = remotion_path / "public" / "avatar"
    remotion_avatar_dir.mkdir(parents=True, exist_ok=True)
    remotion_avatar_path = remotion_avatar_dir / f"{safe_video_id}.mp4"
    if source_avatar_path.resolve() != remotion_avatar_path.resolve():
        shutil.copyfile(source_avatar_path, remotion_avatar_path)

    resolved_output_path = (
        _project_path(output_path)
        if output_path
        else settings.output_dir / "hybrid" / f"{safe_video_id}.mp4"
    )
    resolved_output_path.parent.mkdir(parents=True, exist_ok=True)

    props = {
        "customerName": customer_name,
        "accountNumber": account_number,
        "daysOverdue": int(days_overdue),
        "collectionStatus": int(collection_status),
        "amountDue": amount_due,
        "agentName": agent_name,
        "agentRole": agent_role,
        "avatarVideoPath": f"avatar/{safe_video_id}.mp4",
        "durationInFrames": duration_frames,
        "aspectMode": requested_aspect_mode,
        "resolvedAspectMode": resolved_aspect_mode,
    }

    props_path = remotion_path / f"hybrid_props_{safe_video_id}_{uuid.uuid4().hex}.json"
    props_path.write_text(json.dumps(props, ensure_ascii=False, indent=2), encoding="utf-8")

    backend = (settings.remotion_render_backend or "cli").strip().lower()
    try:
        if backend == "service":
            # Persistent renderer service: reuse bundle + Chromium across jobs.
            # The avatar mp4 is read via staticFile("avatar/<id>.mp4") from the
            # shared public dir, so props alone are enough.
            from app.services.remotion_renderer_client import RendererClient

            RendererClient().render(
                entry_point="src/index.jsx",
                composition_id=aspect_config["composition"],
                input_props=props,
                output_location=str(resolved_output_path),
                job_id=safe_video_id,
                request_mode="hybrid_remotion_avatar_pip",
            )
        else:
            command = [
                settings.remotion_npx_binary,
                "--yes",
                "remotion",
                "render",
                "src/index.jsx",
                aspect_config["composition"],
                str(resolved_output_path),
                f"--props={props_path}",
                "--overwrite",
            ]
            if settings.remotion_browser_executable:
                command.append(f"--browser-executable={settings.remotion_browser_executable}")

            result = subprocess.run(
                command,
                cwd=str(remotion_path),
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=900,
            )
            if result.returncode != 0:
                render_output = (result.stdout or "").strip()
                raise HybridRenderError(
                    f"Remotion render failed with exit code {result.returncode}: {render_output[-4000:]}"
                )
    finally:
        try:
            props_path.unlink()
        except FileNotFoundError:
            pass

    final_meta = _verify_media(resolved_output_path, require_audio=True)
    final_duration_seconds = final_meta["duration_seconds"]

    return {
        "output_path": str(resolved_output_path),
        "requested_aspect_mode": requested_aspect_mode,
        "resolved_aspect_mode": resolved_aspect_mode,
        "composition": aspect_config["composition"],
        "width": aspect_config["width"],
        "height": aspect_config["height"],
        "duration_seconds": final_duration_seconds,
        "duration_frames": duration_frames,
    }
