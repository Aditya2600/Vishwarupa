import asyncio
import sys
import hashlib
import json
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from typing import Any, Literal, Optional
from datetime import datetime
import time
from pathlib import Path
from bson import ObjectId

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.constants import SQS_QUEUE_URL
from app.models import (
    AvatarJobAck,
    AvatarJobStatusResponse,
    DirectVideoRequest,
    RemotionVideoRequest,
    StyledVideoResult,
    TemplateVideoRequest,
    VideoJobResult,
    UserCreate,
    Token,
    UserInDB,
    VideoRecord,
)
from app.services.heygen_client import HeyGenClient
from app.services.media_styling_service import MediaStylingService, StyleRequest
from app.services.remotion_service import RemotionService
from app.services.sqs_service import SQSService
from app.services.video_service import VideoService
from app.services.s3_service import S3Service
from app.database import users_collection, videos_collection, drafts_collection, custom_avatars_collection, whatsapp_templates_collection
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user, get_current_admin
from app.workers.avatar_job_worker import AvatarJobWorker
from app.workers.remotion_job_worker import RemotionJobWorker

import logging

logger = logging.getLogger("app")
logger.setLevel(logging.INFO)

formatter = logging.Formatter(
    "%(asctime)s | %(levelname)s | %(message)s"
)
SAMPLE_BULK_CSV_PATH = (
    Path(__file__).resolve().parent.parent
    / "Remotion"
    / "public"
    / "assets"
    / "sample.csv"
)

app = FastAPI(title='Personalized Video Generator', version='1.0.0')
settings.output_dir.mkdir(parents=True, exist_ok=True)
(settings.output_dir / "text-videos").mkdir(parents=True, exist_ok=True)
(settings.output_dir / "avatar-videos").mkdir(parents=True, exist_ok=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


async def poll_sqs():
    print("Starting SQS Worker...")
    try:
        # AvatarJobWorker already internally ignores 'remotion' jobs properly now.
        # Starting independent workers gracefully...

        await asyncio.gather(
            AvatarJobWorker().run_forever(),
            RemotionJobWorker().run_forever()
        )
    except Exception as e:
        logger.error(f"SQS Worker crashed: {e}")


@app.on_event("startup")
async def startup_db_client():
    # Start the worker also while starting up
    asyncio.create_task(poll_sqs())

    if sys.platform == 'win32':
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            print("DEBUG: Set WindowsProactorEventLoopPolicy in startup")
        except Exception as e:
            print(f"DEBUG: Failed to set event loop policy in startup: {e}")

    try:
        # The ping command is cheap and does not require auth.
        await users_collection.database.command("ping")

        print("\n" + "="*50)
        print("SUCCESS: Connected to MongoDB Cluster successfully!")
        print("="*50 + "\n")
    except Exception as e:
        print("\n" + "!"*50)
        print(f"ERROR: Failed to connect to MongoDB: {e}")
        print("!"*50 + "\n")



app.mount('/artifacts', StaticFiles(directory=settings.output_dir), name='artifacts')
service = VideoService()
client = HeyGenClient()
styling_service = MediaStylingService(client=client)
remotion_service = RemotionService()
s3_service = S3Service()
sqs_service = SQSService()

GENERIC_RUNTIME_ERROR = 'Something went wrong while processing your request. Please try again.'
GENERIC_GENERATION_ERROR = "We couldn't generate the video right now. Please try again in a moment."
GENERIC_GENERATION_TIMEOUT_ERROR = 'Video generation is taking longer than expected. Please try again shortly.'


@app.get("/sample-csvs/bulk-campaign")
async def download_bulk_campaign_sample_csv():
    if not SAMPLE_BULK_CSV_PATH.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample CSV not found")

    return FileResponse(
        SAMPLE_BULK_CSV_PATH,
        media_type="text/csv",
        filename=SAMPLE_BULK_CSV_PATH.name,
    )


def _is_generation_route(path: str) -> bool:
    return (
        path.startswith('/generate/')
        or path.startswith('/jobs/')
        or (path.startswith('/videos/') and path.endswith('/status'))
        or (path.startswith('/videos/') and path.endswith('/stylize'))
    )


def _normalize_video_status(status_value: str | None) -> str:
    normalized = (status_value or "processing").strip().lower()
    if normalized in {"completed", "done", "success", "styled"}:
        return "completed"
    if normalized in {"failed", "error"}:
        return "failed"
    return "processing"


def _to_mongo_safe(value: object) -> object:
    if isinstance(value, BaseModel):
        return {
            key: _to_mongo_safe(item)
            for key, item in value.model_dump(mode="python").items()
        }
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {
            key: _to_mongo_safe(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_to_mongo_safe(item) for item in value]
    return value


def _response_video_job_result(result: VideoJobResult) -> VideoJobResult:
    presigned_video_url = s3_service.presign_video_url(result.video_url)
    if presigned_video_url == result.video_url:
        return result
    return result.model_copy(update={'video_url': presigned_video_url})


def _response_styled_video_result(result: StyledVideoResult) -> StyledVideoResult:
    presigned_video_url = s3_service.presign_video_url(result.final_video_url)
    if presigned_video_url == result.final_video_url:
        return result
    return result.model_copy(update={'final_video_url': presigned_video_url})


async def _persist_video_job_result(current_user: str, result: VideoJobResult) -> None:
    update_fields: dict[str, object] = {
        "status": _normalize_video_status(result.status),
        "job_data": _to_mongo_safe(result),
    }
    if result.title:
        update_fields["title"] = result.title
    if result.video_url:
        update_fields["video_url"] = result.video_url

    await videos_collection.update_one(
        {
            "user_id": current_user,
            "job_data.video_id": result.video_id,
        },
        {"$set": update_fields},
    )


async def _mark_video_failed(current_user: str, video_id: str, detail: str) -> None:
    await videos_collection.update_one(
        {
            "user_id": current_user,
            "job_data.video_id": video_id,
        },
        {"$set": {
            "status": "failed",
            "job_data": {"detail": detail},
        }},
    )


def _normalize_avatar_job_status(status_value: str | None) -> Literal['queued', 'processing', 'completed', 'failed']:
    normalized = (status_value or 'queued').strip().lower()
    if normalized in {'processing', 'running', 'started'}:
        return 'processing'
    if normalized in {'completed', 'done', 'success', 'styled'}:
        return 'completed'
    if normalized in {'failed', 'error'}:
        return 'failed'
    return 'queued'


def _build_avatar_job_status_response(job: dict) -> AvatarJobStatusResponse:
    job_data = job.get('job_data') if isinstance(job.get('job_data'), dict) else {}
    status_value = _normalize_avatar_job_status(str(job_data.get('status') or job.get('status') or 'queued'))
    result_payload = job.get('result_payload') if isinstance(job.get('result_payload'), dict) else {}
    if not result_payload and isinstance(job_data.get('result_payload'), dict):
        result_payload = job_data.get('result_payload') or {}

    response_payload = result_payload if result_payload else job_data
    raw_error = job.get('error') or job_data.get('error')
    cleaned_error = raw_error.strip() if isinstance(raw_error, str) else ''
    error = cleaned_error or None
    video_id = str(job.get('_id') or '')
    return AvatarJobStatusResponse(
        _id=video_id,
        status=status_value,
        video_url=s3_service.presign_video_url(
            str(response_payload.get('video_url') or job.get('video_url'))
        ) if (response_payload.get('video_url') or job.get('video_url')) else None,
        thumbnail_url=str(response_payload.get('thumbnail_url')) if response_payload.get('thumbnail_url') else None,
        title=str(response_payload.get('title') or job.get('title')) if (response_payload.get('title') or job.get('title')) else None,
        error=error,
    )


def _mongo_id(value: str) -> ObjectId | str:
    cleaned = str(value).strip()
    if ObjectId.is_valid(cleaned):
        return ObjectId(cleaned)
    return cleaned


def _stored_video_job_id(video: dict[str, Any]) -> str | None:
    job_data = video.get('job_data') if isinstance(video.get('job_data'), dict) else {}
    result_payload = video.get('result_payload') if isinstance(video.get('result_payload'), dict) else {}

    for candidate in (job_data.get('video_id'), result_payload.get('video_id')):
        if candidate:
            return str(candidate)
    return None


async def _find_avatar_video(video_id: str, current_user: str) -> dict[str, Any] | None:
    return await videos_collection.find_one(
        {'_id': _mongo_id(video_id), 'user_id': current_user, 'request_mode': 'avatar_async'}
    )


async def _refresh_processing_video(video: dict[str, Any], current_user: str) -> None:
    if video.get("status") != "processing" or video.get("request_mode") not in {"direct", "template"}:
        return

    external_video_id = _stored_video_job_id(video)
    if not external_video_id:
        return

    try:
        refreshed = await asyncio.to_thread(
            service.get_video_status_result,
            external_video_id,
            request_mode=str(video.get("request_mode") or "direct"),
        )
    except RuntimeError as exc:
        detail = str(exc)
        await _mark_video_failed(current_user, external_video_id, detail)
        video["status"] = "failed"
        video["job_data"] = {"detail": detail}
        return

    await _persist_video_job_result(current_user, refreshed)
    video["status"] = _normalize_video_status(refreshed.status)
    video["title"] = refreshed.title or video.get("title")
    video["video_url"] = refreshed.video_url or video.get("video_url")
    video["job_data"] = _to_mongo_safe(refreshed)


def _serialize_my_video(video: dict[str, Any]) -> dict[str, Any]:
    raw_id = video.get("_id")
    video_id = str(raw_id) if raw_id is not None else ""

    raw_url = video.get("video_url")
    video_url: str | None
    if isinstance(raw_url, str) and "/artifacts/" in raw_url:
        video_url = "/api/artifacts/" + raw_url.split("/artifacts/", 1)[1]
    elif isinstance(raw_url, str):
        video_url = s3_service.presign_video_url(raw_url)
    else:
        video_url = None

    created_at = video.get("created_at")
    updated_at = video.get("updated_at")

    return {
        "_id": video_id,
        "title": str(video.get("title") or ""),
        "status": str(video.get("status") or "queued"),
        "request_mode": str(video.get("request_mode") or ""),
        "video_url": video_url,
        "thumbnail_url": str(video.get("thumbnail_url")) if video.get("thumbnail_url") else None,
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
        "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
    }


def _form_text(value: object) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _form_int(value: object) -> int | None:
    cleaned = _form_text(value)
    if cleaned is None:
        return None
    try:
        return int(cleaned)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f'Invalid integer value: {cleaned}') from exc


def _form_bool(value: object, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


async def _parse_remotion_payload(request: Request) -> RemotionVideoRequest:
    content_type = request.headers.get('content-type', '').lower()

    if 'application/json' in content_type:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=422, detail='Invalid JSON body for remotion request.')
        try:
            return RemotionVideoRequest.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc

    form = await request.form()
    logo_file = form.get('logo_file')
    logo_bytes: bytes | None = None
    logo_filename: str | None = None

    if isinstance(logo_file, UploadFile) or (
        logo_file is not None and hasattr(logo_file, 'read') and hasattr(logo_file, 'filename')
    ):
        logo_filename = logo_file.filename
        logo_bytes = await logo_file.read()

    logo_opacity = _form_int(form.get('logo_opacity'))

    payload = {
        'video_variety': _form_text(form.get('video_variety')) or 'personalized',
        'customer_name': _form_text(form.get('customer_name')),
        'lan': _form_text(form.get('lan')),
        'client_name': _form_text(form.get('client_name')),
        'tos': _form_text(form.get('tos')),
        'loan_amount': _form_text(form.get('loan_amount')),
        'contact_details': _form_text(form.get('contact_details')),
        'product_type': _form_text(form.get('product_type')),
        'language': _form_text(form.get('language')),
        'script_text': _form_text(form.get('script_text')),
        'background_color': _form_text(form.get('background_color')),
        'include_captions': _form_bool(form.get('include_captions')),
        'title_prefix': _form_text(form.get('title_prefix')) or 'Loan Recall',
        'video_width': _form_int(form.get('video_width')),
        'video_height': _form_int(form.get('video_height')),
        'subtitle_color': _form_text(form.get('subtitle_color')) or 'White',
        'subtitle_position': _form_text(form.get('subtitle_position')) or 'Bottom',
        'logo_position': _form_text(form.get('logo_position')) or 'Top Right',
        'logo_opacity': 80 if logo_opacity is None else logo_opacity,
        'logo_filename': logo_filename,
        'logo_bytes': logo_bytes,
        'voice_gender': _form_text(form.get('voice_gender')) or 'female',
    }

    try:
        logger.info(f"Remotion video payload started: {payload}")
        return RemotionVideoRequest.model_validate(payload)
    except ValidationError as exc:
        safe_errors = exc.errors()
        for err in safe_errors:
            if 'input' in err and isinstance(err['input'], bytes):
                err['input'] = "<raw_bytes_hidden>"
            if 'logo_bytes' in str(err.get('loc', '')):
                err['input'] = "<raw_bytes_hidden>"
        raise HTTPException(status_code=422, detail=safe_errors) from exc


@app.exception_handler(RuntimeError)
def handle_runtime_error(request: Request, exc: RuntimeError) -> JSONResponse:
    path = request.url.path
    print(f'ERROR: RuntimeError at {path}: {exc}')
    detail = GENERIC_GENERATION_ERROR if _is_generation_route(path) else GENERIC_RUNTIME_ERROR
    return JSONResponse(status_code=502, content={'detail': detail})


@app.exception_handler(TimeoutError)
def handle_timeout_error(request: Request, exc: TimeoutError) -> JSONResponse:
    path = request.url.path
    print(f'ERROR: TimeoutError at {path}: {exc}')
    detail = GENERIC_GENERATION_TIMEOUT_ERROR if _is_generation_route(path) else GENERIC_RUNTIME_ERROR
    return JSONResponse(status_code=504, content={'detail': detail})


@app.get('/health')
def health() -> dict:
    return {'status': 'ok', 'output_dir': str(settings.output_dir.resolve())}


from aiocache import Cache

# Construct the global Cache object
api_cache = Cache(Cache.MEMORY)

@app.get('/meta/avatars')
async def list_avatars() -> dict:
    import time
    start = time.time()

    cached_data = await api_cache.get("avatars")
    if cached_data is not None:
        ms = (time.time() - start) * 1000
        print(f"\n⚡ [AVATAR CACHE HIT] Served directly from Cache Class in {ms:.3f} ms")
        return cached_data

    print("\n⏳ [AVATAR CACHE EMPTY] Fetching data directly from HeyGen API...")

    avatars_resp = client.list_avatars()
    try:
        talking_photos_resp = client.list_talking_photos()
    except Exception:
        talking_photos_resp = {"data": {"talking_photos": []}}

    # Merge them. extractAvatarArray in frontend looks for root.avatars, data.avatars, etc.
    # We can just put them both in a list or merge the data arrays.

    avatars_data = avatars_resp.get("data", {}).get("avatars", [])
    talking_photos_data = talking_photos_resp.get("data", {}).get("talking_photos", [])

    # Standardize talking photos to look more like avatars
    for tp in talking_photos_data:
        tp["avatar_id"] = tp.get("talking_photo_id")
        tp["avatar_name"] = tp.get("talking_photo_name") or "Talking Photo"
        tp["style"] = "Talking Photo"
        tp["preview_image_url"] = tp.get("talking_photo_url")
        # HeyGen talking photos often don't have gender in the root, maybe we can keep it as unknown

    all_avatars = list(avatars_data or []) + list(talking_photos_data or [])

    # Fetch dynamically from MongoDB
    db_avatars_cursor = custom_avatars_collection.find({})
    db_avatars_list = await db_avatars_cursor.to_list(length=100)

    db_target_ids = []
    db_avatars_map = {}

    for db_av in db_avatars_list:
        aid = db_av.get("avatar_id")
        if aid:
            db_target_ids.append(aid)
            db_avatars_map[aid] = db_av

    updated_avatars = []
    target_avatars_found = {}

    for a in all_avatars:
        aid = a.get("avatar_id")
        name = a.get("avatar_name", "").lower()

        # Standardize gender for Talking Photos or missing genders
        if not a.get("gender"):
            if "aditi" in name or "female" in name or "woman" in name:
                a["gender"] = "female"
            elif "male" in name or "man" in name:
                a["gender"] = "male"

        if aid in db_target_ids:
            # Override HeyGen's raw data with our precise Database Definitions
            db_def = db_avatars_map[aid]
            a["avatar_name"] = db_def.get("avatar_name", a.get("avatar_name"))
            a["preview_image_url"] = db_def.get("preview_image_url", a.get("preview_image_url"))
            a["gender"] = db_def.get("gender", a.get("gender"))
            a["is_premium"] = db_def.get("is_premium", False)
            a["style"] = db_def.get("style", "Lead Avatar")
            target_avatars_found[aid] = a
        else:
            updated_avatars.append(a)

    top_avatars = []

    # Ensure all requested DB avatars are placed at the very top, even if HeyGen API dropped them
    for aid in db_target_ids:
        if aid in target_avatars_found:
            top_avatars.append(target_avatars_found[aid])
        else:
            db_def = db_avatars_map[aid]
            top_avatars.append({
                "avatar_id": aid,
                "avatar_name": db_def.get("avatar_name", "Custom Avatar"),
                "style": db_def.get("style", "Lead Avatar"),
                "gender": db_def.get("gender", "unknown"),
                "is_premium": db_def.get("is_premium", False),
                "preview_image_url": db_def.get("preview_image_url", "")
            })
    indian_name_hints = ["aahana", "abhishek", "aditi", "aditya", "ankit", "arjun", "aryan", "diya", "ishita", "kabir", "kavya", "kishore", "maya", "mohan", "rahul", "rohan", "shruti", "sneha", "aakash", "ananya", "neha", "amit", "vikram"]
    unprofessional_hints = ["outdoor", "sport", "casual", "t-shirt", "tshirt", "t shirt"]

    final_males = []
    final_females = []
    seen_base_names = {a.get("avatar_name", "").split()[0].lower() for a in top_avatars if a.get("avatar_name")}

    for a in updated_avatars:
        name = a.get("avatar_name", "")

        # Remove gender assumptions for strictly matching Indian names since some avatars have blank gender
        if not a.get("gender"):
            if "female" in name.lower() or "woman" in name.lower():
                a["gender"] = "female"
            elif "male" in name.lower() or "man" in name.lower():
                a["gender"] = "male"
            else:
                n_lower = name.lower()
                if any(x in n_lower for x in ["aahana", "aditi", "diya", "ishita", "kavya", "maya", "shruti", "sneha", "ananya", "neha"]):
                    a["gender"] = "female"
                elif any(x in n_lower for x in ["abhishek", "aditya", "ankit", "arjun", "aryan", "kabir", "karan", "kishore", "mohan", "rahul", "rohan", "sanjay", "aakash", "amit", "vikram"]):
                    a["gender"] = "male"

        n_lower = name.lower()
        if any(unprof in n_lower for unprof in unprofessional_hints):
            continue  # strictly exclude unprofessional/outdoor avatars

        current_gender = a.get("gender", "").lower()
        base_name = name.split()[0].lower() if name else ""

        if any(ind in n_lower for ind in indian_name_hints) and base_name not in seen_base_names:
            if current_gender == "male" and len(final_males) < 3:
                a["style"] = "Professional Male"
                # Clean up ugly HeyGen nametags
                a["avatar_name"] = name.replace(" in Brown blazer", "").replace(" in Blue blazer", "").replace(" in Black suit", "")
                final_males.append(a)
                seen_base_names.add(base_name)

            elif current_gender == "female" and len(final_females) < 3:
                # User explicitly requested Kavya Sofa Front, skip all other Kavyas
                if "kavya" in n_lower and "sofa front" not in n_lower:
                    continue

                a["style"] = "Professional Female"
                a["avatar_name"] = name.replace(" Indoor Front", "").replace(" Sofa Front", "").replace(" Office Front", "")
                final_females.append(a)
                seen_base_names.add(base_name)

        if len(final_males) == 3 and len(final_females) == 3:
            break

    # Guarantee EXACTLY 5 total males and exactly 5 total females. Force pad if the catalog falls short natively.
    m_idx = len(final_males)
    f_idx = len(final_females)
    generic_male_names = ["Arjun", "Aditya", "Rohan"]
    generic_female_names = ["Shruti", "Sneha", "Kavya"]

    for a in updated_avatars:
        if m_idx == 3 and f_idx == 3:
            break

        if not a.get("preview_image_url") and not a.get("preview_url"):
            continue # Ensure we only use avatars with actual loaded thumbnails

        name = a.get("avatar_name", "")
        base_name = name.split()[0].lower() if name else ""
        if base_name in seen_base_names:
            continue

        n_lower = name.lower()
        if any(unprof in n_lower for unprof in unprofessional_hints):
            continue

        current_gender = a.get("gender", "").lower()
        if current_gender == "male" and m_idx < 3:
            a["style"] = "Professional Male"
            a["avatar_name"] = generic_male_names[m_idx]
            final_males.append(a)
            seen_base_names.add(base_name)
            m_idx += 1
        elif current_gender == "female" and f_idx < 3:
            a["style"] = "Professional Female"
            a["avatar_name"] = generic_female_names[f_idx]
            final_females.append(a)
            seen_base_names.add(base_name)
            f_idx += 1

    # Guarantee EXACTLY 5 total males and exactly 5 total females. Force pad if the catalog falls short natively using Mediterranean/tan-skin models.
    m_idx = len(final_males)
    f_idx = len(final_females)
    generic_male_names = ["Arjun", "Aditya", "Rohan"]
    generic_female_names = ["Shruti", "Sneha", "Kavya"]

    brown_passing_male_hints = ["juan", "adrian", "marcos", "lucas", "rafael", "david", "mateo", "daniel"]
    brown_passing_female_hints = ["adriana", "maria", "elena", "sofia", "isabella", "ana", "carmen", "laura"]

    for a in updated_avatars:
        if m_idx == 3 and f_idx == 3:
            break

        if not a.get("preview_image_url") and not a.get("preview_url"):
            continue # Ensure we only use avatars with actual loaded thumbnails

        name = a.get("avatar_name", "")
        base_name = name.split()[0].lower() if name else ""
        if base_name in seen_base_names:
            continue

        n_lower = name.lower()
        if any(unprof in n_lower for unprof in unprofessional_hints):
            continue

        current_gender = a.get("gender", "").lower()

        # Only inject avatars that physically appear tan or Mediterranean to act as Indian stand-ins
        is_brown_male = any(h in n_lower for h in brown_passing_male_hints)
        is_brown_female = any(h in n_lower for h in brown_passing_female_hints)

        if current_gender == "male" and m_idx < 3 and is_brown_male:
            a["style"] = "Professional Male"
            a["avatar_name"] = generic_male_names[m_idx]
            final_males.append(a)
            seen_base_names.add(base_name)
            m_idx += 1
        elif current_gender == "female" and f_idx < 3 and is_brown_female:
            a["style"] = "Professional Female"
            a["avatar_name"] = generic_female_names[f_idx]
            final_females.append(a)
            seen_base_names.add(base_name)
            f_idx += 1

    # Combine lists: top_avatars first
    final_list = top_avatars + final_males + final_females

    result = {
        "data": {
            "avatars": final_list
        }
    }

    await api_cache.set("avatars", result, ttl=7200)
    ms = (time.time() - start) * 1000
    print(f"✅ [AVATAR CACHE SAVED] Fetched from HeyGen and wrote to aiocache in {ms:.3f} ms")

    return result


@app.get('/meta/voices')
async def list_voices() -> dict:
    import time
    start = time.time()

    cached_data = await api_cache.get("voices")
    if cached_data is not None:
        ms = (time.time() - start) * 1000
        print(f"\n⚡ [VOICE CACHE HIT] Served directly from Cache Class in {ms:.3f} ms")
        return cached_data

    print("\n⏳ [VOICE CACHE EMPTY] Fetching data directly from HeyGen API...")

    raw_result = client.list_voices()
    voices = raw_result.get("data", {}).get("voices", [])

    # Filter out explicitly removed voices (generic Aditi) but keep Adv. Aditi Mehra.
    # Then de-duplicate near-identical name variants so users see only one useful entry.
    filtered_voices = []
    seen_adv_aditi = False
    for v in voices:
        v_name = v.get("name", "").lower()
        # Exclude if it's the generic Aditi (starts with aditi) and not the custom advocate voice
        if "aditi" in v_name or "mehra" in v_name:
            if "adv" in v_name or "mehra" in v_name:
                if seen_adv_aditi:
                    continue
                seen_adv_aditi = True
            else:
                continue

        filtered_voices.append(v)

    def _voice_name_key(voice: dict) -> str:
        raw_name = str(voice.get("name") or voice.get("voice_name") or "").lower()
        normalized = "".join(char if (char.isalnum() or char.isspace()) else " " for char in raw_name)
        return " ".join(normalized.split())

    def _has_preview_audio(voice: dict) -> bool:
        return bool(
            voice.get("preview_audio")
            or voice.get("preview_audio_url")
            or voice.get("preview_url")
            or voice.get("audio_preview_url")
        )

    deduped_voices: list[dict] = []
    name_to_index: dict[str, int] = {}
    for voice in filtered_voices:
        key = _voice_name_key(voice)
        if not key:
            deduped_voices.append(voice)
            continue

        existing_index = name_to_index.get(key)
        if existing_index is None:
            name_to_index[key] = len(deduped_voices)
            deduped_voices.append(voice)
            continue

        existing_voice = deduped_voices[existing_index]
        if _has_preview_audio(voice) and not _has_preview_audio(existing_voice):
            deduped_voices[existing_index] = voice

    if "data" in raw_result and "voices" in raw_result["data"]:
        raw_result["data"]["voices"] = deduped_voices

    await api_cache.set("voices", raw_result, ttl=7200)
    ms = (time.time() - start) * 1000
    print(f"✅ [VOICE CACHE SAVED] Fetched from HeyGen and wrote to aiocache in {ms:.3f} ms")

    return raw_result


@app.get('/meta/config')
def get_config() -> dict:
    return {
        "default_avatar_id": settings.heygen_avatar_id,
        "default_voice_id": settings.heygen_voice_id,
        "default_template_id": settings.heygen_template_id,
        "default_language": "Hindi"
    }





@app.get('/proxy-audio')
async def proxy_audio(url: str):
    import httpx
    from fastapi.responses import StreamingResponse
    print(f"DEBUG: Proxying audio from {url}")

    async def stream_audio():
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5"
        }
        async with httpx.AsyncClient(follow_redirects=True, headers=headers) as client:
            try:
                async with client.stream('GET', url) as response:
                    async for chunk in response.aiter_bytes():
                        yield chunk
            except Exception:
                pass

    return StreamingResponse(stream_audio(), media_type="audio/mpeg")


@app.get('/meta/templates')
def list_templates(current_user: str = Depends(get_current_user)) -> dict:
    return client.list_templates()


@app.get('/meta/template/{template_id}')
def get_template_details(template_id: str, version: str = 'v3', current_user: str = Depends(get_current_user)) -> dict:
    return client.get_template_details(template_id, version=version)


# ── WhatsApp Campaign Templates (DB-backed) ───────────────────────────────────

@app.get('/meta/whatsapp-templates')
async def list_whatsapp_templates(current_user: str = Depends(get_current_user)):
    """Return all WhatsApp campaign templates stored in MongoDB."""
    cursor = whatsapp_templates_collection.find({}, {"_id": 0})
    templates = await cursor.to_list(length=200)
    return templates


@app.post('/admin/whatsapp-templates')
async def create_whatsapp_template(payload: dict, admin_user: dict = Depends(get_current_admin)):
    """Admin-only: insert a new WhatsApp campaign template."""
    required = {"id", "name", "whatsapp"}
    missing = required - payload.keys()
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required fields: {missing}")
    existing = await whatsapp_templates_collection.find_one({"id": payload["id"]})
    if existing:
        raise HTTPException(status_code=409, detail=f"Template with id '{payload['id']}' already exists.")
    await whatsapp_templates_collection.insert_one(payload)
    return {"status": "created", "id": payload["id"]}


@app.put('/admin/whatsapp-templates/{template_id}')
async def update_whatsapp_template(template_id: str, payload: dict, admin_user: dict = Depends(get_current_admin)):
    """Admin-only: update an existing WhatsApp campaign template."""
    result = await whatsapp_templates_collection.update_one({"id": template_id}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found.")
    return {"status": "updated", "id": template_id}


@app.delete('/admin/whatsapp-templates/{template_id}')
async def delete_whatsapp_template(template_id: str, admin_user: dict = Depends(get_current_admin)):
    """Admin-only: delete a WhatsApp campaign template."""
    result = await whatsapp_templates_collection.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found.")
    return {"status": "deleted", "id": template_id}


async def _proxy_cpaas_request(method: str, path: str, payload: Any | None = None) -> JSONResponse:
    if not settings.cpaas_api_auth_token:
        raise HTTPException(status_code=500, detail="CPAAS_API_AUTH_TOKEN is not configured.")

    import httpx

    payload_summary = payload
    if isinstance(payload, dict):
        payload_summary = dict(payload)
        leads = payload_summary.get("leads")
        if isinstance(leads, list):
            payload_summary["leadCount"] = len(leads)
            payload_summary["firstLead"] = leads[0] if leads else None
            payload_summary.pop("leads", None)

    url = f"{settings.cpaas_api_base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {
        "Accept": "application/json",
        "API-AUTH-TOKEN": settings.cpaas_api_auth_token,
    }

    if payload is not None:
        headers["Content-Type"] = "application/json"

    logger.info(
        "CPAAS request | method=%s | path=%s | payload=%s",
        method,
        path,
        json.dumps(payload_summary, default=str),
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(method, url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        logger.exception("CPAAS transport failure | method=%s | path=%s", method, path)
        raise HTTPException(status_code=502, detail=f"Failed to reach CPAAS service: {exc}") from exc

    content_type = response.headers.get("content-type", "")
    response_text = response.text
    if "application/json" in content_type.lower():
        try:
            body: Any = response.json()
        except ValueError:
            body = {
                "success": response.is_success,
                "status": response.status_code,
                "message": response_text,
            }
    else:
        body = {
            "success": response.is_success,
            "status": response.status_code,
            "message": response_text,
        }

    logger.info(
        "CPAAS response | method=%s | path=%s | status=%s | body=%s",
        method,
        path,
        response.status_code,
        json.dumps(body, default=str)[:4000],
    )

    return JSONResponse(status_code=response.status_code, content=body)


@app.post('/cpaas/campaigns')
async def create_cpaas_campaign(payload: dict, current_user: str = Depends(get_current_user)):
    upstream_payload = dict(payload)
    if not upstream_payload.get("communicationType") and upstream_payload.get("campaignType"):
        upstream_payload["communicationType"] = upstream_payload["campaignType"]
    return await _proxy_cpaas_request("POST", "/campaigns", upstream_payload)


@app.post('/cpaas/campaigns/push-lead')
async def push_cpaas_campaign_leads(payload: dict, current_user: str = Depends(get_current_user)):
    return await _proxy_cpaas_request("POST", "/campaigns/push-lead", payload)


@app.post('/cpaas/campaigns/{campaign_code}/status')
async def update_cpaas_campaign_status(
    campaign_code: str,
    status: str = Query(...),
    current_user: str = Depends(get_current_user),
):
    return await _proxy_cpaas_request("POST", f"/campaigns/{campaign_code}/status?status={status}")


# --- Authentication Endpoints ---

@app.post("/auth/signup", response_model=dict)
async def signup(user: UserCreate):
    normalized_email = str(user.email).strip().lower()
    display_name = (user.full_name or normalized_email.split("@", 1)[0]).strip()

    print(f"DEBUG: Signup request received for user: {normalized_email}")
    existing_user = await users_collection.find_one({"email": normalized_email})
    if existing_user:
        print(f"DEBUG: User {normalized_email} already exists")
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    user_dict = user.model_dump()
    user_dict["email"] = normalized_email
    user_dict["full_name"] = user.full_name.strip() if user.full_name else None
    user_dict["username"] = display_name
    user_dict["hashed_password"] = hashed_password
    del user_dict["password"]

    await users_collection.insert_one(user_dict)
    print(f"DEBUG: User {normalized_email} successfully registered")
    return {"message": "User created successfully"}

@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    login_identifier = form_data.username.strip()
    normalized_identifier = login_identifier.lower()

    print(f"DEBUG: Login request received for account: {login_identifier}")
    user = await users_collection.find_one(
        {
            "$or": [
                {"email": normalized_identifier},
                {"email": login_identifier},
                {"username": login_identifier},
            ]
        }
    )
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        print(f"DEBUG: Login failed for account: {login_identifier}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    print(f"DEBUG: Login successful for account: {login_identifier}")
    access_token = create_access_token(data={"sub": str(user["_id"]), "email": user["email"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "email": user["email"],
        "full_name": user.get("full_name"),
        "is_admin": user.get("is_admin", False),
    }


# --- Video Generation Endpoints ---

@app.post('/jobs/avatar', response_model=AvatarJobAck)
async def create_avatar_job(request: DirectVideoRequest, current_user: str = Depends(get_current_user)):
    queue_url = SQS_QUEUE_URL

    video_id: str | None = None
    try:
        now = datetime.utcnow()
        request_payload = _to_mongo_safe(request.model_dump(mode='python'))
        video_record = VideoRecord(
            user_id=current_user,
            status='queued',
            title=f"{request.title_prefix} - {request.customer_name}",
            request_mode='avatar_async',
            job_data={
                'request_mode': 'avatar',
                'status': 'queued',
                'attempts': 0,
                'request_payload': request_payload,
            },
        )
        video_doc = _to_mongo_safe(video_record)
        if isinstance(video_doc, dict):
            video_doc.update({
                'request_payload': request_payload,
                'result_payload': None,
                'error': None,
                'attempts': 0,
                'updated_at': now,
                'started_at': None,
                'completed_at': None,
            })
        insert_result = await videos_collection.insert_one(video_doc)
        video_id = str(insert_result.inserted_id)
        sqs_service.send_job(
            payload={'_id': video_id, 'request_mode': 'avatar'},
            queue_url=queue_url,
        )
        return AvatarJobAck(_id=video_id, status='queued')
    except HTTPException:
        raise
    except Exception as exc:
        if not video_id:
            raise HTTPException(status_code=502, detail=GENERIC_GENERATION_ERROR) from exc
        failed_at = datetime.utcnow()
        await videos_collection.update_one(
            {'_id': _mongo_id(video_id), 'user_id': current_user},
            {'$set': {
                'status': 'failed',
                'error': str(exc),
                'updated_at': failed_at,
                'completed_at': failed_at,
                'job_data': {
                    'request_mode': 'avatar',
                    'status': 'failed',
                    'error': str(exc),
                },
            }},
        )
        raise HTTPException(status_code=502, detail=GENERIC_GENERATION_ERROR) from exc


@app.get('/jobs/{video_id}', response_model=AvatarJobStatusResponse)
async def get_avatar_job_status(video_id: str, current_user: str = Depends(get_current_user)):
    video = await _find_avatar_video(video_id, current_user)
    if not video:
        raise HTTPException(status_code=404, detail='Job not found.')
    return _build_avatar_job_status_response(video)

@app.post('/generate/direct')
async def generate_direct(request: DirectVideoRequest, wait: bool = True, current_user: str = Depends(get_current_user)):
    result = service.generate_direct(request, wait=wait)

    if wait and result.saved_to:
        s3_url = s3_service.upload_video(result.saved_to, f"videos/{result.video_id}.mp4")
        if s3_url:
            result.video_url = s3_url

    # Save to MongoDB
    video_record = VideoRecord(
        user_id=current_user,
        status="completed" if wait else "processing",
        title=f"{request.title_prefix} - {request.customer_name}",
        request_mode="direct",
        job_data=_to_mongo_safe(result)
    )
    await videos_collection.insert_one(_to_mongo_safe(video_record))
    
    return _response_video_job_result(result)


@app.get('/videos/{video_id}/status')
async def get_video_status(
    video_id: str,
    request_mode: str = 'direct',
    current_user: str = Depends(get_current_user),
):
    if request_mode.startswith('remotion'):
        doc = await videos_collection.find_one({"_id": _mongo_id(video_id)})
        
        # Safe logging without cp1252 crash
        try:
            print(f">>> found doc: {bool(doc)} {video_id}")
        except:
            pass
            
        if not doc:
            raise HTTPException(status_code=404, detail="Video not found")
            
        return {
            "request_mode": request_mode,
            "video_id": str(doc["_id"]),
            "_id": str(doc["_id"]),
            "status": doc.get("status", "pending"),
            "video_url": s3_service.presign_video_url(doc.get("video_url"))
        }

    result = service.get_video_status_result(video_id, request_mode=request_mode)
    await _persist_video_job_result(current_user, result)
    return _response_video_job_result(result)


@app.post('/videos/{video_id}/stylize', response_model=StyledVideoResult)
async def stylize_video(
    video_id: str,
    request: Request,
    include_captions: bool = Form(False),
    subtitle_color: str = Form('White'),
    subtitle_position: str = Form('Bottom'),
    transcript: str | None = Form(None),
    logo_position: str = Form('Top Right'),
    logo_opacity: int = Form(80),
    logo_file: UploadFile | None = File(None),
    current_user: str = Depends(get_current_user)
):
    print(f"DEBUG: Stylize request for video {video_id} by {current_user}")
    stored_video = await videos_collection.find_one(
        {
            "user_id": current_user,
            "$or": [
                {"_id": _mongo_id(video_id)},
                {"job_data.video_id": video_id},
                {"result_payload.video_id": video_id},
            ],
        }
    )
    resolved_video_id = _stored_video_job_id(stored_video) if stored_video else None
    try:
        artifact = styling_service.style_video(
            resolved_video_id or video_id,
            StyleRequest(
                include_captions=include_captions,
                subtitle_color=subtitle_color,
                subtitle_position=subtitle_position,
                transcript=transcript,
                logo_position=logo_position,
                logo_opacity=logo_opacity,
                logo_filename=logo_file.filename if logo_file else None,
                logo_bytes=await logo_file.read() if logo_file else None,
            ),
        )
    except ValueError as exc:
        print(f"DEBUG: Stylize failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    final_relative = artifact.final_video_path.relative_to(settings.output_dir).as_posix()
    video_url = f"/api/artifacts/{final_relative}"

    s3_url = s3_service.upload_video(artifact.final_video_path, f"videos/{video_id}.mp4")
    if s3_url:
        video_url = s3_url

    result = StyledVideoResult(
        video_id=video_id,
        status='styled',
        source_video_path=artifact.source_video_path,
        source_video_url=artifact.source_video_url,
        final_video_path=artifact.final_video_path,
        final_video_url=video_url,
        subtitle_file_path=artifact.subtitle_file_path,
        logo_file_path=artifact.logo_file_path,
        subtitle_source=artifact.subtitle_source,
    )

    # Update MongoDB record
    await videos_collection.update_one(
        {
            "user_id": current_user,
            "$or": [
                {"_id": _mongo_id(video_id)},
                {"job_data.video_id": resolved_video_id or video_id},
                {"result_payload.video_id": resolved_video_id or video_id},
            ],
        },
        {"$set": {
            "status": "styled",
            "video_url": result.final_video_url,
            "job_data": _to_mongo_safe(result)
        }}
    )
    print(f"DEBUG: Stylize completed and updated in DB for video {video_id}")
    return _response_styled_video_result(result)


@app.post('/generate/template')
async def generate_template(request: TemplateVideoRequest, wait: bool = True, current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Template generation request by {current_user}")
    result = service.generate_from_template(request, wait=wait)

    if wait and result.saved_to:
        s3_url = s3_service.upload_video(result.saved_to, f"videos/{result.video_id}.mp4")
        if s3_url:
            result.video_url = s3_url

    # Save to MongoDB
    video_record = VideoRecord(
        user_id=current_user,
        status="completed" if wait else "processing",
        title=f"Template Video - {request.customer_name}",
        request_mode="template",
        job_data=_to_mongo_safe(result)
    )
    await videos_collection.insert_one(_to_mongo_safe(video_record))
    print(f"DEBUG: Template generation saved to DB")
    return _response_video_job_result(result)


@app.post('/generate/remotion', response_model=VideoJobResult)
async def generate_remotion(request: Request, current_user: str = Depends(get_current_user)):

    payload = await _parse_remotion_payload(request)
    logger.info(f"Remotion video payload ended:")
    # 1. Create a deterministic hash of the entire configuration payload
    payload_dict = payload.model_dump(exclude_none=True)
    if 'logo_bytes' in payload_dict and payload_dict['logo_bytes']:
        payload_dict['logo_bytes'] = str(len(payload_dict['logo_bytes']))
    
    payload_str = json.dumps(payload_dict, sort_keys=True, ensure_ascii=False)
    payload_hash = hashlib.sha256(payload_str.encode('utf-8')).hexdigest()

    # 2. Check Database for an identical completed video globally
    cached_record = await videos_collection.find_one({
        "request_mode": "remotion",
        "status": "completed",
        "job_data.payload_hash": payload_hash
    })

    if cached_record and cached_record.get('job_data'):
        # Reconstruct the VideoJobResult from the stored dataset directly
        job_data = cached_record['job_data'].copy()
        job_data.pop('payload_hash', None)
        return _response_video_job_result(VideoJobResult(**job_data))

    from bson import ObjectId
    video_id = str(ObjectId())
    logger.info(f"Initialized new Remotion video job with ID: {video_id}")

    # Build the queued result
    job_result = VideoJobResult(
        request_mode='remotion',
        video_id=video_id,
        status='queued',
        video_url=None,
        thumbnail_url=None,
        title=f"{payload.title_prefix} - {payload.customer_name} - {payload.lan}",
        raw_response={},
        saved_to=None,
    )

    embeddable_job_data = {
        'payload_hash': f"{payload_hash}_{time.time()}",
        'request_payload': _to_mongo_safe(payload),
        'request_mode': 'remotion'
    }

    video_record = VideoRecord(
        user_id=current_user,
        status="queued",
        title=f"{payload.title_prefix} - {payload.customer_name} - {payload.lan}",
        video_url=None,
        request_mode="remotion_async",
        job_data=embeddable_job_data
    )
    
    video_record_dict = _to_mongo_safe(video_record)
    
    insert_result = await videos_collection.insert_one(video_record_dict)
    video_id = str(insert_result.inserted_id)
    
    # Build the queued result using the MongoDB-generated ID
    job_result = VideoJobResult(
        request_mode='remotion',
        video_id=video_id,
        status='queued',
        video_url=None,
        thumbnail_url=None,
        title=f"{payload.title_prefix} - {payload.customer_name} - {payload.lan}",
        raw_response={},
        saved_to=None,
    )
    
    # NOTE: Render and S3 Upload logic has been moved to the RemotionJobWorker 
    # for asynchronous processing to prevent API timeouts.
    logger.info(f"Job record {video_id} persisted to database. Handing off to SQS queue...")
    
    # 3. Submit to SQS
    try:
        from app.services.sqs_service import SQSService
        from app.constants import SQS_QUEUE_URL
        sqs_svc = SQSService()
        sqs_svc.send_job(
            payload={
                '_id': video_id,
                'request_mode': 'remotion'
            },
            queue_url=SQS_QUEUE_URL
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        with open("sqs_fail.log", "a") as f:
            f.write(f"SQS FAIL: {e}\n{traceback.format_exc()}\n")
        await videos_collection.delete_one({'_id': _mongo_id(video_id)})
        raise HTTPException(status_code=500, detail=f"Failed to enqueue remotion video generation: {e}")

    # Local development fallback: process the job in the current API process
    # immediately as well. The worker claims only queued jobs, so this does not
    # double-render when SQS polling is healthy.
    asyncio.create_task(RemotionJobWorker()._process_job(video_id, None))

    # Return the 'queued' result instantly.
    # The background worker will handle the render and update the DB status.
    # The frontend will poll for status until completion.
    logger.info(f"Remotion job enqueued: {video_id}. Returning success now.")
    return _response_video_job_result(job_result)


@app.get('/my-videos')
async def get_my_videos(current_user: str = Depends(get_current_user)):
    logger.info("Loading /my-videos for user %s", current_user)
    cursor = videos_collection.find({"user_id": current_user}).sort("created_at", -1)
    videos = await cursor.to_list(length=100)
    logger.info("Loaded %d videos for user %s", len(videos), current_user)

    refresh_tasks = [
        _refresh_processing_video(video, current_user)
        for video in videos
        if video.get("status") == "processing" and video.get("request_mode") in {"direct", "template"}
    ]
    if refresh_tasks:
        refresh_results = await asyncio.gather(*refresh_tasks, return_exceptions=True)
        for refresh_result in refresh_results:
            if isinstance(refresh_result, Exception):
                logger.exception("Failed to refresh background direct video: %s", refresh_result)

    serialized_videos: list[dict[str, Any]] = []
    for video in videos:
        try:
            serialized_videos.append(_serialize_my_video(video))
        except Exception as exc:
            logger.exception(
                "Failed to serialize /my-videos item for user %s and video %s: %s",
                current_user,
                str(video.get("_id") or ""),
                exc,
            )

        # Preserve payloads for frontend auto-fill logic in Bulk Send
        # video.pop("request_payload", None)
        # video.pop("result_payload", None)
        video.pop("job_data", None)

    logger.info("Returning %d serialized videos for user %s", len(serialized_videos), current_user)
    return serialized_videos
    

@app.get('/videos/{video_id}')
async def get_video_details(video_id: str, current_user: str = Depends(get_current_user)):
    """Fetch details for a single video. Accessible by owner or admin."""
    video = await videos_collection.find_one({"_id": _mongo_id(video_id)})
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    # Check permissions: owner or admin
    is_admin = False
    try:
        user = await users_collection.find_one({"_id": _mongo_id(current_user)})
        if user and user.get("is_admin"):
            is_admin = True
    except:
        pass

    if video.get("user_id") != current_user and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    video["_id"] = str(video["_id"])
    url = video.get("video_url")
    if url and isinstance(url, str) and "/artifacts/" in url:
        video["video_url"] = "/api/artifacts/" + url.split("/artifacts/", 1)[1]
    elif isinstance(url, str):
        video["video_url"] = s3_service.presign_video_url(url)
    
    video.pop("job_data", None)
    return video


@app.get('/meta/whatsapp-templates')
async def get_whatsapp_templates():
    """Returns dynamic WhatsApp templates for bulk campaigns."""
    try:
        cursor = whatsapp_templates_collection.find({})
        templates = await cursor.to_list(length=50)
        for t in templates:
            t["_id"] = str(t["_id"])
        
        if not templates:
            # Fallback to the official CPSTest if DB is empty
            return [{
                "id": "cpstest",
                "name": "Infobip CPSTest",
                "desc": "Official WhatsApp template for debt recovery.",
                "color": "indigo",
                "whatsapp": "This is regarding loan due. Kindly follow the video for more information.",
                "scriptPersonalized": "Hello {{customer_name}}. This is regarding your outstanding loan due with CredResolve. Kindly follow the information in this video for more details and repayment options.",
                "scriptUniversal": "This is regarding your outstanding loan due. Kindly follow the information in this video for more details and repayment options."
            }]
        return templates
    except Exception as e:
        logger.error(f"Failed to fetch whatsapp templates: {e}")
        return []

@app.get('/custom-avatars')
async def get_custom_avatars():
    """Returns metadata for precisely matched custom Indian avatars (like Adv. Mahesh).
    Different from /jobs/avatar which is used to submit a real generation job."""
    cursor = custom_avatars_collection.find({})
    avatars = await cursor.to_list(length=100)
    for av in avatars:
        av["_id"] = str(av["_id"])
    return avatars

@app.get('/ping')
async def ping():
    return {"status": "ok"}

@app.post('/preview/voice')
async def preview_voice(
    language: str = Form(...),
    gender: str = Form(...),
    text: str = Form(None),
    voice_id: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    print(f"DEBUG: Voice preview request - lang: {language}, gender: {gender}, voice_id: {voice_id}, text_len: {len(text or '') if text else 0}")
    
    # If we have a HeyGen voice_id, try using HeyGen's TTS for a perfectly matched preview
    if voice_id and not (voice_id.startswith("en-") or voice_id.startswith("hi-") or "-" in voice_id and len(voice_id) < 20):
        try:
            tts_resp = client.generate_tts(voice_id, text or "")
            audio_url = tts_resp.get("data", {}).get("audio_url")
            if audio_url:
                # Proxy the HeyGen audio URL to avoid CORS and ensure stability
                import httpx
                from fastapi.responses import StreamingResponse
                
                async def stream_audio():
                    async with httpx.AsyncClient(follow_redirects=True) as c:
                        try:
                            async with c.stream('GET', audio_url) as response:
                                if response.status_code >= 400:
                                    print(f"DEBUG: HeyGen TTS stream failed with status {response.status_code}")
                                async for chunk in response.aiter_bytes():
                                    yield chunk
                        except Exception as e:
                            print(f"DEBUG: HeyGen TTS stream exception: {e}")
                return StreamingResponse(stream_audio(), media_type="audio/mpeg")
        except Exception as e:
            print(f"DEBUG: HeyGen TTS failed, falling back to edge-tts: {e}")
    
    # Fallback to RemotionService/edge-tts if HeyGen failed or wasn't attempted
    try:
        from app.services.remotion_service import RemotionService
        from app.models import LeadRecord, DirectVideoRequest
        from app.services.script_renderer import build_context, _normalize_placeholder_syntax
        from jinja2 import Environment
        
        # Safe defaults for the preview context
        dummy_lead = LeadRecord(
            customer_name="Ramesh Kumar",
            lan="LAN12345",
            client_name="ABC Finance",
            tos="38450",
            loan_amount="120000",
            contact_details="1800-555-999",
            product_type="loan"
        )
        # We don't pass language to LeadRecord because it's not a field there
        context = build_context(dummy_lead)
        
        # Render the preview text if it contains placeholders
        preview_text = text or "Hello, this is a voice preview."
        try:
            env = Environment()
            template = env.from_string(_normalize_placeholder_syntax(preview_text))
            final_text = template.render(**context)
        except Exception:
            final_text = preview_text

        import tempfile
        import subprocess
        import os
        from app.services.remotion_service import normalize_hindi_numbers, VOICE_MAP
        
        voice_key = f"{language}-{gender.capitalize()}"
        voice = VOICE_MAP.get(voice_key, "hi-IN-SwaraNeural")
        
        if language == "Hindi":
            final_text = normalize_hindi_numbers(final_text)

        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8') as f:
            f.write(final_text)
            temp_text_file = f.name
            
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as out_f:
            audio_path = out_f.name

        import sys
        command = f'"{sys.executable}" -m edge_tts --voice "{voice}" --file "{temp_text_file}" --write-media "{audio_path}"'
        
        def run_tts():
            with tempfile.NamedTemporaryFile() as out_l, tempfile.NamedTemporaryFile() as err_l:
                result = subprocess.run(command, shell=True, stdout=out_l, stderr=err_l, stdin=subprocess.DEVNULL)
                err_l.seek(0)
                if result.returncode != 0:
                    raise Exception(f"Voice preview TTS failed: {err_l.read().decode('utf-8', errors='ignore')}")

        await asyncio.to_thread(run_tts)
        
        try:
            os.remove(temp_text_file)
        except:
            pass
            
        if not Path(audio_path).exists():
            raise HTTPException(status_code=500, detail="Generated audio file not found")

        return FileResponse(
            audio_path,
            media_type="audio/mpeg",
            filename=f"preview_{language}_{gender}.mp3"
        )
    except Exception as exc:
        import traceback
        error_msg = f"ERROR in preview_voice: {str(exc)}\n{traceback.format_exc()}"
        print(error_msg)
        try:
            debug_file = Path("c:/Users/RentoBees/Desktop/vid_fix/debug_preview.log")
            with open(debug_file, "a", encoding="utf-8") as f:
                f.write(f"\n--- {datetime.now()} ---\n{error_msg}\n")
        except:
            pass
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete('/videos/{video_id}')
async def delete_video(video_id: str, current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Delete request for video {video_id} by {current_user}")
    result = await videos_collection.delete_one({"_id": _mongo_id(video_id), "user_id": current_user})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"status": "success", "message": "Video deleted successfully"}

@app.post('/drafts/save')
async def save_draft(draft: dict, current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Saving draft for {current_user}")
    now = datetime.utcnow()
    result = await drafts_collection.update_one(
        {"user_id": current_user},
        {"$set": {
            "content": draft,
            "updated_at": now,
        }, "$setOnInsert": {
            "created_at": now,
        }},
        upsert=True,
    )
    draft_doc = await drafts_collection.find_one({"user_id": current_user}, sort=[("updated_at", -1)])
    draft_id = str(draft_doc["_id"]) if draft_doc else str(result.upserted_id or "latest")
    return {"status": "success", "draft_id": draft_id}

@app.get('/drafts')
async def get_drafts(current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Fetching drafts for {current_user}")
    cursor = drafts_collection.find({"user_id": current_user}).sort("updated_at", -1)
    drafts = await cursor.to_list(length=50)
    for d in drafts:
        d["_id"] = str(d["_id"])
    return drafts


# --- Admin Endpoints ---


@app.get('/admin/stats')
async def get_admin_stats(admin: dict = Depends(get_current_admin)):
    total_users = await users_collection.count_documents({})
    total_videos = await videos_collection.count_documents({})
    completed = await videos_collection.count_documents({"status": "completed"})
    queued = await videos_collection.count_documents({"status": "queued"})
    failed = await videos_collection.count_documents({"status": "failed"})
    remotion = await videos_collection.count_documents({"request_mode": {"$in": ["remotion", "remotion_async"]}})
    direct = await videos_collection.count_documents({"request_mode": "direct"})
    template = await videos_collection.count_documents({"request_mode": "template"})

    return {
        'total_users': total_users,
        'total_videos': total_videos,
        'completed': completed,
        'queued': queued,
        'failed': failed,
        'remotion': remotion,
        'direct': direct,
        'template': template,
        'status': 'online'
    }


@app.get('/admin/users')

async def get_admin_users(admin: dict = Depends(get_current_admin)):
    cursor = users_collection.find({})
    users = await cursor.to_list(length=500)

    results = []
    for u in users:
        u_id = str(u['_id'])
        video_count = await videos_collection.count_documents({'user_id': u_id})
        if video_count == 0:
            video_count = await videos_collection.count_documents({'user_id': u['email']})
        completed = await videos_collection.count_documents({'user_id': u_id, 'status': 'completed'})

        results.append({
            'id': u_id,
            'email': u['email'],
            'full_name': u.get('full_name', 'N/A'),
            'video_count': video_count,
            'completed_count': completed,
            'is_admin': u.get('is_admin', False),
            'disabled': u.get('disabled', False),
        })
    return results

@app.get('/admin/users/{user_id}/videos')
async def get_user_videos_admin(user_id: str, admin: dict = Depends(get_current_admin)):
    """Fetch all videos for a specific user (admin only)."""
    try:
        oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        user = await users_collection.find_one({"_id": oid})
    except:
        user = None

    conditions = [{"user_id": user_id}]
    if user:
        conditions.append({"user_id": user.get("email", "")})

    cursor = videos_collection.find({"$or": conditions}).sort("created_at", -1)
    videos = await cursor.to_list(length=200)
    for v in videos:
        v['_id'] = str(v['_id'])
        url = v.get('video_url')
        if url and isinstance(url, str) and not "/artifacts/" in url:
            v['video_url'] = s3_service.presign_video_url(url)
        v.pop('job_data', None)
    return videos

@app.get('/admin/all-videos')
async def get_all_videos(search: str = "", status: str = "", admin: dict = Depends(get_current_admin)):
    query: dict = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"user_id": {"$regex": search, "$options": "i"}},
        ]
    cursor = videos_collection.find(query).sort('created_at', -1)
    videos = await cursor.to_list(length=200)
    for v in videos:
        v['_id'] = str(v['_id'])
        url = v.get('video_url')
        if url and isinstance(url, str) and not "/artifacts/" in url:
            v['video_url'] = s3_service.presign_video_url(url)
        v.pop('job_data', None)
    return videos

@app.delete('/admin/videos/{video_id}')
async def admin_delete_video(video_id: str, admin: dict = Depends(get_current_admin)):
    """Admin can delete any video."""
    result = await videos_collection.delete_one({"_id": _mongo_id(video_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"status": "deleted"}

# --- WhatsApp Campaign Analytics & Webhooks ---

@app.post('/meta/whatsapp-webhook')
async def whatsapp_webhook(request: Request):
    """Receives delivery status updates from Infobip Bridge."""
    try:
        data = await request.json()
        # Infobip format: { "results": [ { "messageId": "...", "status": { "groupName": "DELIVERED" } } ] }
        results = data.get("results", [])
        for res in results:
            m_id = res.get("messageId")
            status_group = res.get("status", {}).get("groupName", "UNKNOWN")
            if m_id:
                from app.database import whatsapp_logs_collection
                await whatsapp_logs_collection.update_one(
                    {"message_id": m_id},
                    {"$set": {
                        "status": status_group,
                        "updated_at": datetime.utcnow()
                    }}
                )
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@app.get('/admin/campaign-analytics')
async def get_campaign_analytics(admin: dict = Depends(get_current_admin)):
    """Aggregates WhatsApp logs for the admin dashboard."""
    try:
        from app.database import whatsapp_logs_collection
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        cursor = whatsapp_logs_collection.aggregate(pipeline)
        stats = await cursor.to_list(length=20)
        
        # Format as dictionary for easier charting
        formatted = {s["_id"]: s["count"] for s in stats}
        
        # Recent logs for the table
        recent_cursor = whatsapp_logs_collection.find({}).sort("created_at", -1).limit(50)
        recent_logs = await recent_cursor.to_list(length=50)
        for log in recent_logs:
            log["_id"] = str(log["_id"])
            
        return {
            "summary": formatted,
            "recent": recent_logs
        }
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return {"summary": {}, "recent": []}

@app.post('/admin/whatsapp-logs')
async def log_whatsapp_attempt(data: dict, admin: dict = Depends(get_current_admin)):
    """Helper to log a new send attempt from the frontend."""
    try:
        from app.database import whatsapp_logs_collection
        log_entry = {
            "message_id": data.get("message_id"),
            "phone": data.get("phone"),
            "customer_name": data.get("customer_name"),
            "template_id": data.get("template_id"),
            "status": "SENT",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await whatsapp_logs_collection.insert_one(log_entry)
        return {"status": "logged"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
