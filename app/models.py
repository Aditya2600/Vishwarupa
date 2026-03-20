from pathlib import Path
from typing import Any, Callable, Dict, Optional, Union, Literal
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr, ValidationInfo, field_validator, model_validator


def get_ist_time() -> datetime:
    """Returns the current naive timestamp representing Indian Standard Time (IST).
    Stored naively so MongoDB doesn't forcibly convert it to UTC for display."""
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


class User(BaseModel):
    username: str | None = None
    email: EmailStr
    full_name: str | None = None
    disabled: bool | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserInDB(User):
    hashed_password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    email: EmailStr
    full_name: str | None = None


class TokenData(BaseModel):
    email: str | None = None


class VideoRecord(BaseModel):
    user_id: str
    video_id: str
    status: str
    title: str | None = None
    video_url: str | None = None
    request_mode: str
    created_at: datetime = Field(default_factory=get_ist_time)
    job_data: dict | None = None


class AvatarJobAck(BaseModel):
    video_id: str
    status: Literal['queued']


class AvatarJobStatusResponse(BaseModel):
    video_id: str
    status: Literal['queued', 'processing', 'completed', 'failed']
    video_url: str | None = None
    thumbnail_url: str | None = None
    title: str | None = None
    error: str | None = None


class Draft(BaseModel):
    user_id: str
    content: dict
    created_at: datetime = Field(default_factory=get_ist_time)
    updated_at: datetime = Field(default_factory=get_ist_time)


class LeadRecord(BaseModel):
    customer_name: str | None = "Customer"
    lan: str | None = Field(default="N/A", description='Loan Account Number')
    client_name: str | None = "Bank"
    tos: str | float | int | None = "0"
    loan_amount: str | float | int | None = None
    contact_details: str | None = None
    product_type: str | None = "loan"

    @field_validator('customer_name', 'lan', 'client_name', mode='before')
    @classmethod
    def strip_and_default(cls, value: str | None) -> str:
        if value is None:
            return "Customer"
        cleaned = str(value).strip()
        return cleaned or "Customer"


class DirectVideoRequest(LeadRecord):
    tos: str | float | int | None = None
    avatar_id: str | None = None
    voice_id: str | None = None
    language: str | None = None
    template_name: str = 'legal_notice_raw_hi.txt'
    script_text: str | None = None
    background_color: str | None = None
    include_captions: bool = False
    folder: str | None = None
    title_prefix: str = 'Legal Notice'
    video_width: int | None = None
    video_height: int | None = None
    voice_gender: Literal['male', 'female'] | None = 'female'

    @field_validator('script_text')
    @classmethod
    def normalize_script_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator('video_width', 'video_height')
    @classmethod
    def validate_video_dimension(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError('video dimensions must be positive')
        return value


class RemotionVideoRequest(DirectVideoRequest):
    video_variety: Literal['personalized', 'universal'] | None = 'personalized'
    title_prefix: str = 'Loan Recall'
    subtitle_color: str = 'White'
    subtitle_position: str = 'Bottom'
    logo_position: str = 'Top Right'
    logo_opacity: int = 80
    logo_filename: str | None = None
    logo_bytes: bytes | None = None
    primary_color: str | None = "#003366"
    secondary_color: str | None = "#FF9900"

    @field_validator('tos', 'loan_amount', 'contact_details', 'product_type', mode='before')
    @classmethod
    def validate_optional_remotion_fields(cls, value: str | float | int | None, info: ValidationInfo) -> str | float | int:
        if value is None:
            # Provide sensible defaults for optional fields to avoid rendering issues.
            return "0" if info.field_name in ('tos', 'loan_amount') else ("1800-555-999" if info.field_name == 'contact_details' else "loan")

        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or ("0" if info.field_name in ('tos', 'loan_amount') else ("1800-555-999" if info.field_name == 'contact_details' else "loan"))
        return value

    @field_validator('logo_opacity')
    @classmethod
    def validate_logo_opacity(cls, value: int) -> int:
        if not 0 <= value <= 100:
            raise ValueError('logo_opacity must be between 0 and 100')
        return value

    @field_validator('logo_filename')
    @classmethod
    def normalize_logo_filename(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class TemplateVideoRequest(LeadRecord):
    template_id: str | None = None
    payload_path: str | None = None
    folder: str | None = None


class VideoJobResult(BaseModel):
    request_mode: Literal['direct', 'template', 'remotion']
    video_id: str
    status: str
    video_url: str | None = None
    thumbnail_url: str | None = None
    title: str | None = None
    raw_response: dict
    saved_to: Path | None = None
    video_path: str | None = None
    audio_path: str | None = None


class StyledVideoResult(BaseModel):
    video_id: str
    status: Literal['styled']
    source_video_path: Path
    source_video_url: str
    final_video_path: Path
    final_video_url: str
    subtitle_file_path: Path | None = None
    logo_file_path: Path | None = None
    subtitle_source: Literal['provider', 'transcript', 'disabled']
