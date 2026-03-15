from typing import Literal
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.models import DirectVideoRequest, RemotionVideoRequest, StyledVideoResult, TemplateVideoRequest, VideoJobResult, UserCreate, Token, UserInDB, VideoRecord
from app.services.heygen_client import HeyGenClient
from app.services.media_styling_service import MediaStylingService, StyleRequest
from app.services.remotion_service import RemotionService
from app.services.video_service import VideoService
from app.database import users_collection, videos_collection, drafts_collection
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user

app = FastAPI(title='Personalized Video Generator', version='1.0.0')
settings.output_dir.mkdir(parents=True, exist_ok=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.on_event("startup")
async def startup_db_client():
    try:
        # The ping command is cheap and does not require auth.
        await users_collection.database.command("ping")
        print("\n" + "="*50)
        print("✅ SUCCESS: Connected to MongoDB Cluster successfully!")
        print("="*50 + "\n")
    except Exception as e:
        print("\n" + "!"*50)
        print(f"❌ ERROR: Failed to connect to MongoDB: {e}")
        print("!"*50 + "\n")
app.mount('/artifacts', StaticFiles(directory=settings.output_dir), name='artifacts')
service = VideoService()
client = HeyGenClient()
styling_service = MediaStylingService(client=client)
remotion_service = RemotionService()


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
        {"video_id": result.video_id, "user_email": current_user},
        {"$set": update_fields},
    )


async def _mark_video_failed(current_user: str, video_id: str, detail: str) -> None:
    await videos_collection.update_one(
        {"video_id": video_id, "user_email": current_user},
        {"$set": {
            "status": "failed",
            "job_data": {"detail": detail},
        }},
    )


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
    }

    try:
        return RemotionVideoRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


@app.exception_handler(RuntimeError)
def handle_runtime_error(_request: Request, exc: RuntimeError) -> JSONResponse:
    return JSONResponse(status_code=502, content={'detail': str(exc)})


@app.exception_handler(TimeoutError)
def handle_timeout_error(_request: Request, exc: TimeoutError) -> JSONResponse:
    return JSONResponse(status_code=504, content={'detail': str(exc)})


@app.get('/health')
def health() -> dict:
    return {'status': 'ok', 'output_dir': str(settings.output_dir.resolve())}


@app.get('/meta/avatars')
def list_avatars() -> dict:
    return client.list_avatars()


@app.get('/meta/voices')
def list_voices() -> dict:
    return client.list_voices()


@app.get('/meta/templates')
def list_templates(current_user: str = Depends(get_current_user)) -> dict:
    return client.list_templates()


@app.get('/meta/template/{template_id}')
def get_template_details(template_id: str, version: str = 'v3', current_user: str = Depends(get_current_user)) -> dict:
    return client.get_template_details(template_id, version=version)


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
    access_token = create_access_token(data={"sub": user["email"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "email": user["email"],
        "full_name": user.get("full_name"),
    }


# --- Video Generation Endpoints ---

@app.post('/generate/direct')
async def generate_direct(request: DirectVideoRequest, wait: bool = True, current_user: str = Depends(get_current_user)):
    result = service.generate_direct(request, wait=wait)
    
    # Save to MongoDB
    video_record = VideoRecord(
        user_email=current_user,
        video_id=result.get("video_id") if isinstance(result, dict) else result.video_id,
        status="completed" if wait else "processing",
        title=f"{request.title_prefix} - {request.customer_name}",
        request_mode="direct",
        job_data=_to_mongo_safe(result)
    )
    await videos_collection.insert_one(_to_mongo_safe(video_record))
    
    return result


@app.get('/videos/{video_id}/status')
async def get_video_status(
    video_id: str,
    request_mode: Literal['direct', 'template'] = 'direct',
    current_user: str = Depends(get_current_user),
):
    result = service.get_video_status_result(video_id, request_mode=request_mode)
    await _persist_video_job_result(current_user, result)
    return result


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
    try:
        artifact = styling_service.style_video(
            video_id,
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
    result = StyledVideoResult(
        video_id=video_id,
        status='styled',
        source_video_path=artifact.source_video_path,
        source_video_url=artifact.source_video_url,
        final_video_path=artifact.final_video_path,
        final_video_url=str(request.url_for('artifacts', path=final_relative)),
        subtitle_file_path=artifact.subtitle_file_path,
        logo_file_path=artifact.logo_file_path,
        subtitle_source=artifact.subtitle_source,
    )

    # Update MongoDB record
    await videos_collection.update_one(
        {"video_id": video_id},
        {"$set": {
            "status": "styled",
            "video_url": result.final_video_url,
            "job_data": _to_mongo_safe(result)
        }}
    )
    print(f"DEBUG: Stylize completed and updated in DB for video {video_id}")
    return result


@app.post('/generate/template')
async def generate_template(request: TemplateVideoRequest, wait: bool = True, current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Template generation request by {current_user}")
    result = service.generate_from_template(request, wait=wait)
    
    # Save to MongoDB
    video_record = VideoRecord(
        user_email=current_user,
        video_id=result.get("video_id") if isinstance(result, dict) else result.video_id,
        status="completed" if wait else "processing",
        title=f"Template Video - {request.customer_name}",
        request_mode="template",
        job_data=_to_mongo_safe(result)
    )
    await videos_collection.insert_one(_to_mongo_safe(video_record))
    print(f"DEBUG: Template generation saved to DB")
    return result


@app.post('/generate/remotion', response_model=VideoJobResult)
async def generate_remotion(request: Request, current_user: str = Depends(get_current_user)):
    payload = await _parse_remotion_payload(request)

    try:
        result = await remotion_service.generate_video(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    relative_video_path = result['video_path'].relative_to(settings.output_dir).as_posix()
    
    job_result = VideoJobResult(
        request_mode='remotion',
        video_id=result['job_id'],
        status='completed',
        video_url=str(request.url_for('artifacts', path=relative_video_path)),
        thumbnail_url=None,
        title=f"{payload.title_prefix} - {payload.customer_name} - {payload.lan}",
        raw_response={
            'job_id': result['job_id'],
            'audio_path': str(result['audio_path']),
            'text': result['text'],
        },
        saved_to=result['video_path'],
        video_path=str(result['video_path']),
        audio_path=str(result['audio_path']),
    )

    # Save to MongoDB
    video_record = VideoRecord(
        user_email=current_user,
        video_id=job_result.video_id,
        status="completed",
        title=job_result.title,
        video_url=job_result.video_url,
        request_mode="remotion",
        job_data=_to_mongo_safe(job_result)
    )
    await videos_collection.insert_one(_to_mongo_safe(video_record))
    
    return job_result

@app.get('/my-videos')
async def get_my_videos(current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Fetching videos for {current_user}")
    cursor = videos_collection.find({"user_email": current_user}).sort("created_at", -1)
    videos = await cursor.to_list(length=100)

    for video in videos:
        if video.get("status") != "processing" or video.get("request_mode") not in {"direct", "template"}:
            continue

        try:
            refreshed = service.get_video_status_result(
                str(video["video_id"]),
                request_mode=str(video.get("request_mode") or "direct"),
            )
        except RuntimeError as exc:
            detail = str(exc)
            await _mark_video_failed(current_user, str(video["video_id"]), detail)
            video["status"] = "failed"
            video["job_data"] = {"detail": detail}
            continue

        await _persist_video_job_result(current_user, refreshed)
        video["status"] = _normalize_video_status(refreshed.status)
        video["title"] = refreshed.title or video.get("title")
        video["video_url"] = refreshed.video_url or video.get("video_url")
        video["job_data"] = _to_mongo_safe(refreshed)

    for video in videos:
        video["_id"] = str(video["_id"])
    return videos

@app.post('/drafts/save')
async def save_draft(draft: dict, current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Saving draft for {current_user}")
    now = datetime.utcnow()
    result = await drafts_collection.update_one(
        {"user_email": current_user},
        {"$set": {
            "content": draft,
            "updated_at": now,
        }, "$setOnInsert": {
            "created_at": now,
        }},
        upsert=True,
    )
    draft_doc = await drafts_collection.find_one({"user_email": current_user}, sort=[("updated_at", -1)])
    draft_id = str(draft_doc["_id"]) if draft_doc else str(result.upserted_id or "latest")
    return {"status": "success", "draft_id": draft_id}

@app.get('/drafts')
async def get_drafts(current_user: str = Depends(get_current_user)):
    print(f"DEBUG: Fetching drafts for {current_user}")
    cursor = drafts_collection.find({"user_email": current_user}).sort("updated_at", -1)
    drafts = await cursor.to_list(length=50)
    for d in drafts:
        d["_id"] = str(d["_id"])
    return drafts
