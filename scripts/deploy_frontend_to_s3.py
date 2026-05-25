"""
Deploy the built Vite frontend (`Frontend/dist/`) to an S3 bucket.

This is useful when you want to host the interactive web experience (including
`/i/loan-offer/:id`) from S3 + CloudFront instead of an Nginx container.

Notes:
- This script uploads files and sets sensible Content-Type / Cache-Control.
- It does NOT modify bucket policy, static website settings, or CloudFront.
- By default it does NOT delete any existing S3 objects.
"""

from __future__ import annotations

import argparse
import mimetypes
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class UploadHeaders:
    content_type: str
    cache_control: str


def _guess_headers(local_path: Path, rel_posix: str) -> UploadHeaders:
    """
    - HTML must not be aggressively cached, otherwise deploys can appear "stuck".
    - Hashed assets in `assets/` can be cached long-term + immutable.
    """
    content_type, encoding = mimetypes.guess_type(local_path.name)
    content_type = content_type or "application/octet-stream"

    # Fix a couple of common cases where the local Python mimetypes DB can vary.
    if local_path.suffix == ".js":
        content_type = "application/javascript"
    elif local_path.suffix == ".css":
        content_type = "text/css"
    elif local_path.suffix == ".svg":
        content_type = "image/svg+xml"
    elif local_path.suffix == ".woff2":
        content_type = "font/woff2"
    elif local_path.suffix == ".woff":
        content_type = "font/woff"
    elif local_path.suffix == ".ttf":
        content_type = "font/ttf"
    elif local_path.suffix == ".otf":
        content_type = "font/otf"
    elif local_path.suffix == ".map":
        content_type = "application/json"
    elif local_path.suffix == ".json":
        content_type = "application/json"

    # Cache strategy
    if local_path.name in {"index.html", "404.html"} or local_path.suffix == ".html":
        cache_control = "no-cache, no-store, must-revalidate"
    elif rel_posix.startswith("assets/"):
        cache_control = "public, max-age=31536000, immutable"
    else:
        cache_control = "public, max-age=3600"

    # We don't currently manage Content-Encoding; keep type simple.
    _ = encoding

    return UploadHeaders(content_type=content_type, cache_control=cache_control)


def _iter_dist_files(dist_dir: Path) -> list[Path]:
    files: list[Path] = []
    for p in dist_dir.rglob("*"):
        if p.is_file():
            files.append(p)
    return sorted(files)


def _route_keys(route: str) -> list[str]:
    cleaned = route.strip().lstrip("/")
    if not cleaned:
        return []

    cleaned = cleaned.rstrip("/")
    if cleaned.endswith("/index.html"):
        cleaned = cleaned[: -len("/index.html")].rstrip("/")
    elif cleaned == "index.html":
        cleaned = ""

    if not cleaned:
        return ["index.html"]

    return [cleaned, f"{cleaned}/index.html"]


def _upload_file(
    *,
    s3: Any,
    local_path: Path,
    bucket: str,
    key: str,
    headers: UploadHeaders,
    public_read: bool,
    dry_run: bool,
) -> None:
    extra_args: dict[str, str] = {
        "ContentType": headers.content_type,
        "CacheControl": headers.cache_control,
    }
    if public_read:
        extra_args["ACL"] = "public-read"

    if dry_run:
        print(f"DRYRUN upload s3://{bucket}/{key} ({headers.content_type})")
        return

    s3.upload_file(
        Filename=str(local_path),
        Bucket=bucket,
        Key=key,
        ExtraArgs=extra_args,
    )
    print(f"Uploaded s3://{bucket}/{key}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload Frontend/dist to S3.")
    parser.add_argument("--bucket", required=True, help="Target S3 bucket name.")
    parser.add_argument(
        "--prefix",
        default="",
        help="Optional key prefix (e.g. 'web/' or 'prod/'). No leading slash.",
    )
    parser.add_argument(
        "--dist-dir",
        default=str(Path("Frontend") / "dist"),
        help="Path to built dist directory.",
    )
    parser.add_argument(
        "--public-read",
        action="store_true",
        help="Attempt to set ACL=public-read per object (may fail if bucket owner enforced).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would upload, but don't upload.",
    )
    parser.add_argument(
        "--spa-route",
        action="append",
        default=[],
        help=(
            "Upload dist index.html to this SPA route key as well. "
            "Example: --spa-route loan-offer/VIDEO_ID. Can be passed multiple times."
        ),
    )
    parser.add_argument(
        "--loan-offer-id",
        action="append",
        default=[],
        help=(
            "Shortcut for --spa-route loan-offer/ID. Useful for publishing a single "
            "interactive loan offer URL."
        ),
    )
    parser.add_argument(
        "--html-only",
        action="store_true",
        help="Upload only index.html plus requested SPA route HTML keys, not hashed assets.",
    )

    args = parser.parse_args()

    dist_dir = Path(args.dist_dir).resolve()
    if not dist_dir.exists() or not dist_dir.is_dir():
        raise SystemExit(f"dist dir not found: {dist_dir}")

    env_path = Path(__file__).resolve().parents[1] / ".env"
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(env_path)
    except ModuleNotFoundError:
        if env_path.exists():
            print("python-dotenv is not installed; continuing with shell environment variables.")

    # Lazy import so users get a clearer error if boto3 isn't installed.
    try:
        import boto3  # type: ignore
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "boto3 is not installed. Activate your backend venv and install requirements.txt first."
        ) from exc

    prefix = str(args.prefix or "").strip().lstrip("/")
    if prefix and not prefix.endswith("/"):
        prefix += "/"

    # Make sure mimetypes has a reasonable default DB, especially on minimal images.
    mimetypes.init()

    s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION") or None)
    files = _iter_dist_files(dist_dir)
    if not files:
        raise SystemExit(f"no files found in: {dist_dir}")

    index_path = dist_dir / "index.html"
    if not index_path.exists():
        raise SystemExit(f"index.html not found in: {dist_dir}")

    spa_routes = list(args.spa_route or [])
    spa_routes.extend(f"loan-offer/{loan_offer_id}" for loan_offer_id in args.loan_offer_id or [])
    route_keys: list[str] = []
    seen_route_keys: set[str] = set()
    for route in spa_routes:
        for route_key in _route_keys(route):
            if route_key not in seen_route_keys:
                seen_route_keys.add(route_key)
                route_keys.append(route_key)

    if args.html_only and not route_keys:
        raise SystemExit("--html-only requires at least one --spa-route or --loan-offer-id")

    print(f"Bucket: {args.bucket}")
    print(f"Prefix: {prefix or '(root)'}")
    print(f"Dist:   {dist_dir}")
    print(f"Files:  {1 if args.html_only else len(files)}")
    if route_keys:
        print(f"SPA route HTML keys: {len(route_keys)}")

    upload_files = [index_path] if args.html_only else files
    for local_path in upload_files:
        rel = local_path.relative_to(dist_dir)
        rel_posix = rel.as_posix()
        key = f"{prefix}{rel_posix}"
        headers = _guess_headers(local_path, rel_posix)
        _upload_file(
            s3=s3,
            local_path=local_path,
            bucket=args.bucket,
            key=key,
            headers=headers,
            public_read=args.public_read,
            dry_run=args.dry_run,
        )

    route_headers = _guess_headers(index_path, "index.html")
    for route_key in route_keys:
        _upload_file(
            s3=s3,
            local_path=index_path,
            bucket=args.bucket,
            key=f"{prefix}{route_key}",
            headers=route_headers,
            public_read=args.public_read,
            dry_run=args.dry_run,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
