from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.hybrid_remotion_avatar_pip_service import render_hybrid_avatar_pip_video


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Render a local hybrid Remotion avatar PIP collection notice video."
    )
    parser.add_argument("--avatar", required=True, help="Path to a local avatar MP4 with audio.")
    parser.add_argument("--customer-name", required=True)
    parser.add_argument("--account-number", required=True)
    parser.add_argument("--days-overdue", required=True, type=int)
    parser.add_argument("--collection-status", required=True, type=int)
    parser.add_argument("--amount-due")
    parser.add_argument("--agent-name", required=True)
    parser.add_argument("--agent-role", required=True)
    parser.add_argument(
        "--aspect-mode",
        required=True,
        choices=["portrait_9_16", "landscape_16_9", "auto"],
    )
    parser.add_argument("--viewport-width", type=int)
    parser.add_argument("--viewport-height", type=int)
    parser.add_argument("--output")
    return parser


def _video_id_from_output(output: str | None) -> str:
    if output:
        stem = Path(output).stem.strip()
        if stem:
            return stem
    return f"hybrid-local-{uuid.uuid4().hex[:12]}"


def main() -> None:
    args = _build_parser().parse_args()
    metadata = render_hybrid_avatar_pip_video(
        video_id=_video_id_from_output(args.output),
        avatar_mp4_path=args.avatar,
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
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
