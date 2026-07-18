from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_CPAAS_API_PREFIX = '/cpaas/api/v1'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    heygen_api_key: str
    heygen_base_url: str = 'https://api.heygen.com'
    heygen_avatar_id: str | None = None
    heygen_voice_id: str | None = None
    heygen_template_id: str | None = None
    heygen_template_payload_path: str = 'sample_data/template_payload.json'
    frontend_url: str
    
    # Custom Avatars Configuration
    avatar_id_mahesh: str = "2311cba09f374de6b971ea5fa23ff993"
    avatar_id_rahul: str = "932371fea0eb462ea9beccff656d4823"
    avatar_id_priya: str = "c56120f1c7564d20b1f87416a6b8d0d1"
    avatar_id_adv_aditi_mehra: str = "b8d00c953a114b299792b6197a80cc70"
    avatar_id_adv_dev_kumar: str = "b55e2ddc1ff145839b27e25be19e4e59"
    default_video_width: int = 1280
    default_video_height: int = 720
    default_background_color: str = '#F4F4F4'
    default_output_dir: str = 'output'
    ffmpeg_binary: str = 'ffmpeg'
    subtitle_font_path: str | None = None
    remotion_dir: str = 'Remotion'
    edge_tts_binary: str = 'edge-tts'
    remotion_npx_binary: str = 'npx'
    remotion_browser_executable: str | None = None
    remotion_renderer_port: int | None = None
    remotion_force_ipv4: bool = True
    # Renderer backend: 'service' uses the long-lived Node renderer (production
    # path); 'cli' keeps the legacy per-job `npx remotion render` (rollback).
    remotion_render_backend: str = 'cli'
    remotion_renderer_url: str | None = None
    remotion_render_concurrency: int = 1
    remotion_renderer_connect_timeout_seconds: float = 5.0
    edge_tts_timeout_seconds: int = 600
    remotion_render_timeout_seconds: int = 600
    poll_interval_seconds: int = 8
    poll_timeout_seconds: int = 2400
    edge_tts_delay_seconds: float = 0.0
    strict_validation: bool = True
    cors_allow_all: bool = True
    cors_allow_origins: str = 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:4173,http://127.0.0.1:4173'
    
    # AWS S3 Settings
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = 'us-east-1'
    sqs_wait_time_seconds: int = 20
    # Must exceed the longest a worker holds a message before deleting it, i.e. the
    # full Remotion pipeline: edge_tts_timeout_seconds (600) + remotion_render_timeout_seconds
    # (600) + S3 upload buffer. Otherwise SQS redelivers mid-job and the duplicate is
    # dropped by the atomic claim, losing SQS redelivery as the crash-recovery path.
    sqs_visibility_timeout_seconds: int = 1500
    sqs_max_receive_count: int = 3
    sqs_dlq_queue_url: str | None = None
    cpaas_api_base_url: str
    cpaas_api_auth_token: str | None = None

    xai_api_key: str | None = None
    xai_model_name: str = "grok-4-1-fast-reasoning"

    @field_validator('heygen_avatar_id', 'heygen_voice_id', 'heygen_template_id', mode='before')
    @classmethod
    def normalize_optional_ids(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()
        if not cleaned:
            return None

        placeholder_values = {
            'optional_avatar_id',
            'optional_template_id',
            'optional_voice_id',
            'your_avatar_id',
            'your_template_id',
            'your_voice_id',
        }
        return None if cleaned.lower() in placeholder_values else cleaned

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parent.parent

    @property
    def output_dir(self) -> Path:
        path = Path(self.default_output_dir)
        return path if path.is_absolute() else self.project_root / path

    @property
    def remotion_path(self) -> Path:
        path = Path(self.remotion_dir)
        return path if path.is_absolute() else self.project_root / path

    @property
    def cpaas_api_root_url(self) -> str:
        raw = self.cpaas_api_base_url.strip()
        parsed = urlsplit(raw)
        normalized_path = parsed.path.rstrip('/') or DEFAULT_CPAAS_API_PREFIX
        return urlunsplit((parsed.scheme, parsed.netloc, normalized_path, '', ''))

    @property
    def cors_origins(self) -> list[str]:
        origins: list[str] = []
        for origin in self.cors_allow_origins.split(','):
            cleaned = origin.strip()
            if cleaned:
                origins.append(cleaned)
        return origins


settings = Settings()
