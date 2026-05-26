from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.hybrid_remotion_avatar_pip_service import (
    HybridAvatarGenerationError,
    generate_raw_avatar_for_hybrid,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a raw HeyGen talking avatar MP4 for later hybrid Remotion PIP rendering."
    )
    parser.add_argument("--customer-name", required=True)
    parser.add_argument("--account-number", required=True)
    parser.add_argument("--days-overdue", required=True, type=int)
    parser.add_argument("--amount-due")
    parser.add_argument("--avatar-id", required=True)
    parser.add_argument("--voice-id", required=True)
    parser.add_argument("--agent-name", required=True)
    parser.add_argument("--language", default="hi")
    parser.add_argument("--output-dir")
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    try:
        metadata = generate_raw_avatar_for_hybrid(
            customer_name=args.customer_name,
            account_number=args.account_number,
            days_overdue=args.days_overdue,
            amount_due=args.amount_due,
            avatar_id=args.avatar_id,
            voice_id=args.voice_id,
            agent_name=args.agent_name,
            language=args.language,
            output_dir=args.output_dir,
        )
    except HybridAvatarGenerationError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        raise SystemExit(1) from exc

    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
