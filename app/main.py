import asyncio
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from typing import Literal, Optional
from datetime import datetime
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.models import DirectVideoRequest, RemotionVideoRequest, StyledVideoResult, TemplateVideoRequest, VideoJobResult, UserCreate, Token, UserInDB, VideoRecord
from app.services.heygen_client import HeyGenClient
from app.services.media_styling_service import MediaStylingService, StyleRequest
from app.services.remotion_service import RemotionService
from app.services.video_service import VideoService
from app.services.s3_service import S3Service
from app.database import users_collection, videos_collection, drafts_collection
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user

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

@app.on_event("startup")
async def startup_db_client():
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

GENERIC_RUNTIME_ERROR = 'Something went wrong while processing your request. Please try again.'
GENERIC_GENERATION_ERROR = "We couldn't generate the video right now. Please try again in a moment."
GENERIC_GENERATION_TIMEOUT_ERROR = 'Video generation is taking longer than expected. Please try again shortly.'


def _is_generation_route(path: str) -> bool:
    return (
        path.startswith('/generate/')
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
        return RemotionVideoRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


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


from functools import lru_cache, wraps
import time

def timed_lru_cache(seconds: int, maxsize: int = 128):
    def wrapper_cache(func):
        cached_func = lru_cache(maxsize=maxsize)(func)
        cached_func.expiration = time.time() + seconds

        @wraps(func)
        def wrapped_func(*args, **kwargs):
            if time.time() >= cached_func.expiration:
                cached_func.cache_clear()
                cached_func.expiration = time.time() + seconds
                
            start = time.time()
            res = cached_func(*args, **kwargs)
            ms = (time.time() - start) * 1000
            
            if ms < 5.0:
                print(f"⚡ [CACHE HIT] Loaded instantly from LRU cache in {ms:.3f} ms")
            else:
                print(f"⏳ [CACHE MISS] Fetched from API and built LRU cache in {ms:.3f} ms")
                
            return res
        return wrapped_func
    return wrapper_cache

@app.get('/meta/avatars')
@timed_lru_cache(seconds=7200)
def list_avatars() -> dict:
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
    
    # Force specific avatars to be present and have correct gender/name
    male_target_ids = [settings.avatar_id_rahul, settings.avatar_id_mahesh]
    female_target_ids = [settings.avatar_id_adv_aditi_mehra, settings.avatar_id_priya]
    
    updated_avatars = []
    target_male_avatars = {}
    target_female_avatars = {}
    
    for a in all_avatars:
        aid = a.get("avatar_id")
        name = a.get("avatar_name", "").lower()
        
        # Standardize gender for Talking Photos or missing genders
        if not a.get("gender"):
            if "aditi" in name or "female" in name or "woman" in name:
                a["gender"] = "female"
            elif "male" in name or "man" in name:
                a["gender"] = "male"
        
        if aid in male_target_ids:
            if aid == settings.avatar_id_rahul:
                a["avatar_name"] = "Rahul"
                a["preview_image_url"] = "/rahul.jpg"
            elif aid == settings.avatar_id_mahesh:
                a["avatar_name"] = "Mahesh"
                a["preview_image_url"] = "/mahesh.png"
            a["gender"] = "male"
            a["is_premium"] = False
            a["style"] = "Lead Avatar"
            target_male_avatars[aid] = a
        elif aid in female_target_ids:
            if aid == settings.avatar_id_priya:
                a["avatar_name"] = "Priya"
                a["preview_image_url"] = "/priya.png"
            else:
                a["avatar_name"] = "Adv. Aditi Mehra"
                a["preview_image_url"] = "/Adv_ Aditi_Mehra.png"  # Aditi uses local confirmed image
            a["gender"] = "female"
            a["is_premium"] = False
            a["style"] = "Lead Avatar"  # Keep Aditi at the top
            target_female_avatars[aid] = a
        else:
            updated_avatars.append(a)
            
    top_avatars = []
    
    # Use the found ones or create new ones if missing
    for mid in male_target_ids:
        if mid in target_male_avatars:
            top_avatars.append(target_male_avatars[mid])
        else:
            name_override = "Rahul" if mid == settings.avatar_id_rahul else "Mahesh"
            image_override = "/rahul.jpg" if mid == settings.avatar_id_rahul else "/mahesh.png"
            top_avatars.append({
                "avatar_id": mid,
                "avatar_name": name_override,
                "style": "Lead Avatar",
                "gender": "male",
                "is_premium": False,
                "preview_image_url": image_override
            })
        
    for fid in [settings.avatar_id_adv_aditi_mehra, settings.avatar_id_priya]:
        if fid in target_female_avatars:
            top_avatars.append(target_female_avatars[fid])
        else:
            name_override = "Priya" if fid == settings.avatar_id_priya else "Adv. Aditi Mehra"
            image_override = "/priya.png" if fid == settings.avatar_id_priya else "/Adv_ Aditi_Mehra.png"
            top_avatars.append({
                "avatar_id": fid,
                "avatar_name": name_override,
                "style": "Lead Avatar",
                "gender": "female",
                "is_premium": False,
                "preview_image_url": image_override
            })
    indian_name_hints = ["aahana", "abhishek", "aditi", "aditya", "ankit", "arjun", "aryan", "diya", "ishita", "kabir", "karan", "kavya", "kishore", "maya", "mohan", "rahul", "rohan", "sanjay", "shruti", "sneha", "aakash", "ananya", "neha", "amit", "vikram"]
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
    generic_male_names = ["Arjun", "Aditya", "Karan", "Rohan"]
    generic_female_names = ["Shruti", "Sneha", "Kavya", "Riya"]

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
    generic_male_names = ["Arjun", "Aditya", "Karan", "Rohan"]
    generic_female_names = ["Shruti", "Sneha", "Kavya", "Riya"]
    
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
    return result


@app.get('/meta/voices')
@timed_lru_cache(seconds=7200)
def list_voices() -> dict:
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

    # Note: Relying on the browser to infer the exact container type. audio/mpeg captures the fallback gracefully.
    return StreamingResponse(stream_audio(), media_type="audio/mpeg")


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
    
    if wait and result.saved_to:
        s3_url = s3_service.upload_video(result.saved_to, f"videos/{result.video_id}.mp4")
        if s3_url:
            result.video_url = s3_url
    
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
    
    if wait and result.saved_to:
        s3_url = s3_service.upload_video(result.saved_to, f"videos/{result.video_id}.mp4")
        if s3_url:
            result.video_url = s3_url
    
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
    import hashlib
    import json
    payload = await _parse_remotion_payload(request)

    # 1. Create a deterministic hash of the entire configuration payload
    payload_dict = payload.model_dump(exclude_none=True)
    if 'logo_bytes' in payload_dict and payload_dict['logo_bytes']:
        # Don't natively hash raw bytes directly; hash their length/presence instead if needed, 
        # but to be perfectly safe we can drop them from the string buffer 
        payload_dict['logo_bytes'] = str(len(payload_dict['logo_bytes']))
    
    payload_str = json.dumps(payload_dict, sort_keys=True, ensure_ascii=False)
    payload_hash = hashlib.sha256(payload_str.encode('utf-8')).hexdigest()

    # 2. Check Database for an identical completed video by the current user
    cached_record = await videos_collection.find_one({
        "user_email": current_user,
        "request_mode": "remotion",
        "status": "completed",
        "job_data.payload_hash": payload_hash
    })

    if cached_record and cached_record.get('job_data'):
        print(f"DEBUG: Returning cached Text-to-Video generation for payload hash {payload_hash}")
        # Reconstruct the VideoJobResult from the stored dataset directly
        job_data = cached_record['job_data'].copy()
        job_data.pop('payload_hash', None)
        # Avoid overriding the new unique video_id but serve the exact same URL and metadata
        return VideoJobResult(**job_data)

    try:
        result = await remotion_service.generate_video(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    relative_video_path = result['video_path'].relative_to(settings.output_dir).as_posix()
    video_url = f"/api/artifacts/{relative_video_path}"
    
    s3_url = s3_service.upload_video(result['video_path'], f"videos/{result['job_id']}.mp4")
    if s3_url:
        video_url = s3_url
    
    job_result = VideoJobResult(
        request_mode='remotion',
        video_id=result['job_id'],
        status='completed',
        video_url=video_url,
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

    # 3. Save to MongoDB with the embedded payload hash flag for future queries
    embeddable_job_data = _to_mongo_safe(job_result)
    embeddable_job_data['payload_hash'] = payload_hash

    video_record = VideoRecord(
        user_email=current_user,
        video_id=job_result.video_id,
        status="completed",
        title=job_result.title,
        video_url=job_result.video_url,
        request_mode="remotion",
        job_data=embeddable_job_data
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
        
        url = video.get("video_url")
        if url and isinstance(url, str) and "/artifacts/" in url:
            video["video_url"] = "/api/artifacts/" + url.split("/artifacts/", 1)[1]

    return videos

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
    from app.services.remotion_service import RemotionService
    from app.models import LeadRecord, DirectVideoRequest
    from app.services.script_renderer import build_context, _normalize_placeholder_syntax
    from jinja2 import Environment
    
    try:
        remotion_service = RemotionService()
        
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

        from app.models import RemotionVideoRequest
        dummy_request = RemotionVideoRequest(
            customer_name=dummy_lead.customer_name,
            lan=dummy_lead.lan,
            client_name=dummy_lead.client_name,
            tos=dummy_lead.tos,
            loan_amount=dummy_lead.loan_amount,
            contact_details=dummy_lead.contact_details,
            product_type=dummy_lead.product_type,
            language=language,
            voice_gender=gender,
            script_text=final_text,
            video_variety="personalized"
        )
        
        result = await remotion_service.generate_tts(dummy_request)
        audio_path = Path(result['full_audio_path'])
        
        if not audio_path.exists():
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
    result = await videos_collection.delete_one({"video_id": video_id, "user_email": current_user})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"status": "success", "message": "Video deleted successfully"}

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
