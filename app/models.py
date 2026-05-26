from pathlib import Path
from typing import Any, Callable, Dict, Optional, Union, Literal
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, ConfigDict, Field, EmailStr, ValidationInfo, field_validator, model_validator


def get_ist_time() -> datetime:
    """Returns the current naive timestamp representing Indian Standard Time (IST).
    Stored naively so MongoDB doesn't forcibly convert it to UTC for display."""
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


class User(BaseModel):
    username: str | None = None
    email: EmailStr
    full_name: str | None = None
    disabled: bool | None = None
    is_admin: bool = False


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
    is_admin: bool = False


class TokenData(BaseModel):
    email: str | None = None


class VideoRecord(BaseModel):
    user_id: str
    status: str
    title: str | None = None
    video_url: str | None = None
    request_mode: str
    created_at: datetime = Field(default_factory=get_ist_time)
    job_data: dict | None = None


class AvatarJobAck(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str = Field(alias='_id')
    status: Literal['queued']


class AvatarJobStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str = Field(alias='_id')
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
    template_key: Literal[
        'account_notice',
        'payment_guidance',
        'payment_link_guidance',
        'overdue_template',
        'loan_offer_interactive',
        'loan_reminder',
        'collection_reminder',
        'scene_loan_offer',
        'tvs_credit_emi',
    ] | None = 'account_notice'
    title_prefix: str = 'Loan Recall'
    subtitle_color: str = 'White'
    subtitle_position: str = 'Bottom'
    logo_position: str = 'Top Right'
    logo_opacity: int = 80
    logo_filename: str | None = None
    logo_bytes: bytes | None = None
    loan_reminder_image_paths: dict[str, str] | None = None
    loan_reminder_image_filenames: dict[str, str] | None = None
    loan_reminder_image_bytes: dict[str, bytes] | None = None
    sales_image_paths: dict[str, str] | None = None
    sales_image_filenames: dict[str, str] | None = None
    sales_image_bytes: dict[str, bytes] | None = None
    emi_image_paths: dict[str, str] | None = None
    emi_image_filenames: dict[str, str] | None = None
    emi_image_bytes: dict[str, bytes] | None = None
    payment_url: str | None = None
    days_overdue: int | None = None
    primary_color: str | None = "#003366"
    secondary_color: str | None = "#FF9900"
    max_loan_amount: str | float | int | None = None
    max_tenure: str | float | int | None = None
    max_emi: str | float | int | None = None
    loan_id: str | None = None
    month_24_loan_amount: str | float | int | None = None
    month_30_loan_amount: str | float | int | None = None
    month_36_loan_amount: str | float | int | None = None
    month_42_loan_amount: str | float | int | None = None
    month_48_loan_amount: str | float | int | None = None
    month_60_loan_amount: str | float | int | None = None
    emi_calculation24: str | float | int | None = None
    emi_calculation30: str | float | int | None = None
    emi_calculation36: str | float | int | None = None
    emi_calculation42: str | float | int | None = None
    emi_calculation48: str | float | int | None = None
    emi_calculation60: str | float | int | None = None
    cta_phone_number: str | None = None
    interactive_background_color: str | None = None
    interactive_cta_color: str | None = None

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


class HybridRemotionAvatarPipRequest(BaseModel):
    customer_name: str
    account_number: str
    days_overdue: int
    collection_status: str | None = None
    amount_due: str
    avatar_id: str
    voice_id: str
    agent_name: str = "Priya"
    agent_role: str = "Collections Assistant"
    language: str = "hi"
    aspect_mode: Literal['landscape_16_9', 'portrait_9_16', 'auto'] = "portrait_9_16"
    viewport_width: int | None = None
    viewport_height: int | None = None

    @field_validator(
        'customer_name',
        'account_number',
        'avatar_id',
        'voice_id',
        'agent_name',
        'agent_role',
        'language',
        'amount_due',
    )
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = str(value).strip()
        if not cleaned:
            raise ValueError('value must not be empty')
        return cleaned

    @field_validator('collection_status')
    @classmethod
    def normalize_collection_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator('days_overdue')
    @classmethod
    def validate_non_negative_int(cls, value: int) -> int:
        if value < 0:
            raise ValueError('value must be non-negative')
        return value

    @field_validator('viewport_width', 'viewport_height')
    @classmethod
    def validate_viewport_dimension(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError('viewport dimensions must be positive')
        return value


class HybridRemotionAvatarPipResponse(BaseModel):
    success: bool
    raw_avatar_video_id: str | None
    raw_avatar_path: str | None
    final_video_path: str
    final_video_url: str
    width: int
    height: int
    duration_seconds: float | None = None


class TemplateVideoRequest(LeadRecord):
    template_id: str | None = None
    payload_path: str | None = None
    folder: str | None = None


class VideoJobResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    request_mode: Literal['direct', 'template', 'remotion']
    video_id: str = Field(alias='_id')
    status: str
    video_url: str | None = None
    thumbnail_url: str | None = None
    title: str | None = None
    raw_response: dict | None = None
    saved_to: Path | str | None = None
    video_path: str | None = None
    audio_path: str | None = None
    interactive_url: str | None = None


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


class PDFRecord(BaseModel):
    user_id: str
    phone_number: str | None = None
    language: str | None = 'Hindi'
    status: Literal['pending', 'downloading', 'processing', 'summarizing', 'completed', 'failed'] = 'pending'
    filename: str | None = None
    pdf_url: str | None = None
    original_text: str | None = None
    summary_text: str | None = None
    audio_url: str | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=get_ist_time)
    updated_at: datetime = Field(default_factory=get_ist_time)


class SharedPDFResponse(BaseModel):
    summary_text: str | None = None
    audio_url: str | None = None
    filename: str | None = None
    language: str | None = None
    created_at: datetime
