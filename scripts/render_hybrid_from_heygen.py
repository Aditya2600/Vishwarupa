from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.hybrid_remotion_avatar_pip_service import (
    HybridAvatarGenerationError,
    HybridRenderError,
    generate_raw_avatar_for_hybrid,
    render_hybrid_avatar_pip_video,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a raw HeyGen avatar MP4 and render the local hybrid Remotion PIP video."
    )
    parser.add_argument("--customer-name", required=True)
    parser.add_argument("--account-number", required=True)
    parser.add_argument("--days-overdue", required=True, type=int)
    parser.add_argument("--collection-status", required=True, type=int)
    parser.add_argument("--amount-due")
    parser.add_argument("--avatar-id", required=True)
    parser.add_argument("--voice-id", required=True)
    parser.add_argument("--agent-name", required=True)
    parser.add_argument("--agent-role", required=True)
    parser.add_argument("--language", default="hi")
    parser.add_argument(
        "--aspect-mode",
        required=True,
        choices=["portrait_9_16", "landscape_16_9", "auto"],
    )
    parser.add_argument("--viewport-width", type=int)
    parser.add_argument("--viewport-height", type=int)
    parser.add_argument("--avatar-output-dir")
    parser.add_argument("--output", required=True)
    return parser


def _ffprobe(path: Path) -> dict[str, Any]:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_type,codec_name,width,height,duration",
        "-show_entries",
        "format=duration,size",
        "-of",
        "json",
        str(path),
    ]
    result = subprocess.run(command, check=False, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {path}: {(result.stderr or result.stdout).strip()}")

    try:
        return json.loads(result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"ffprobe returned invalid JSON for {path}") from exc


def _duration_seconds(probe: dict[str, Any]) -> float:
    candidates: list[Any] = [(probe.get("format") or {}).get("duration")]
    candidates.extend(
        stream.get("duration")
        for stream in probe.get("streams") or []
        if isinstance(stream, dict)
    )
    for candidate in candidates:
        try:
            duration = float(candidate)
        except (TypeError, ValueError):
            continue
        if duration > 0:
            return duration
    raise RuntimeError("ffprobe did not report a positive duration")


def _has_stream(probe: dict[str, Any], codec_type: str) -> bool:
    return any(
        isinstance(stream, dict) and stream.get("codec_type") == codec_type
        for stream in probe.get("streams") or []
    )


def _validate_media(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise RuntimeError(f"Expected media file does not exist: {path}")
    size = path.stat().st_size
    if size <= 0:
        raise RuntimeError(f"Expected media file is empty: {path}")

    probe = _ffprobe(path)
    duration = _duration_seconds(probe)
    has_video = _has_stream(probe, "video")
    has_audio = _has_stream(probe, "audio")
    if not has_video:
        raise RuntimeError(f"Expected a video stream in {path}")
    if not has_audio:
        raise RuntimeError(f"Expected an audio stream in {path}")

    return {
        "path": str(path),
        "duration_seconds": duration,
        "size_bytes": size,
        "has_video": has_video,
        "has_audio": has_audio,
        "probe": probe,
    }


def _print_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def main() -> None:
    args = _build_parser().parse_args()

    try:
        raw_avatar = generate_raw_avatar_for_hybrid(
            customer_name=args.customer_name,
            account_number=args.account_number,
            days_overdue=args.days_overdue,
            amount_due=args.amount_due,
            avatar_id=args.avatar_id,
            voice_id=args.voice_id,
            agent_name=args.agent_name,
            language=args.language,
            output_dir=args.avatar_output_dir,
        )

        _print_json(
            {
                "step": "raw_avatar_generated",
                "heygen_video_id": raw_avatar["heygen_video_id"],
                "raw_avatar_local_path": raw_avatar["avatar_local_path"],
                "raw_avatar_duration_seconds": raw_avatar["duration_seconds"],
                "raw_avatar_has_audio": raw_avatar["has_audio"],
                "raw_avatar_has_video": raw_avatar["has_video"],
            }
        )

        raw_probe_summary = _validate_media(Path(raw_avatar["avatar_local_path"]))
        _print_json({"step": "raw_avatar_ffprobe", **raw_probe_summary})

        heygen_video_id = raw_avatar.get("heygen_video_id") or Path(args.output).stem
        final_video = render_hybrid_avatar_pip_video(
            video_id=f"hybrid-{heygen_video_id}",
            avatar_mp4_path=raw_avatar["avatar_local_path"],
            customer_name=args.customer_name,
            account_number=args.account_number,
            days_overdue=args.days_overdue,
            collection_status=args.collection_status,
            amount_due=args.amount_due,
            agent_name=args.agent_name,
            agent_role=args.agent_role,
            aspect_mode=args.aspect_mode,
            viewport_width=args.viewport_width,
            viewport_height=args.viewport_height,
            output_path=args.output,
        )

        _print_json(
            {
                "step": "hybrid_rendered",
                "final_output_path": final_video["output_path"],
                "requested_aspect_mode": final_video["requested_aspect_mode"],
                "resolved_aspect_mode": final_video["resolved_aspect_mode"],
                "composition": final_video["composition"],
                "width": final_video["width"],
                "height": final_video["height"],
                "duration_frames": final_video["duration_frames"],
            }
        )

        final_probe_summary = _validate_media(Path(final_video["output_path"]))
        _print_json({"step": "final_ffprobe", **final_probe_summary})

    except (HybridAvatarGenerationError, HybridRenderError, RuntimeError, OSError) as exc:
        _print_json({"error": str(exc)})
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
