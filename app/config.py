from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    heygen_api_key: str
    heygen_base_url: str = 'https://api.heygen.com'
    heygen_avatar_id: str | None = None
    heygen_voice_id: str | None = None
    heygen_template_id: str | None = None
    heygen_template_payload_path: str = 'sample_data/template_payload.json'
    frontend_url: str = 'https://vishvarupa.credresolve.com'
    
    # Custom Avatars Configuration
    avatar_id_mahesh: str = "2311cba09f374de6b971ea5fa23ff993"
    avatar_id_rahul: str = "932371fea0eb462ea9beccff656d4823"
    avatar_id_priya: str = "c56120f1c7564d20b1f87416a6b8d0d1"
    avatar_id_adv_aditi_mehra: str = "b8d00c953a114b299792b6197a80cc70"
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
    poll_interval_seconds: int = 8
    poll_timeout_seconds: int = 1200
    strict_validation: bool = True
    cors_allow_all: bool = True
    cors_allow_origins: str = 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:4173,http://127.0.0.1:4173'
    
    # AWS S3 Settings
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = 'us-east-1'
    sqs_wait_time_seconds: int = 20
    sqs_visibility_timeout_seconds: int = 120
    sqs_max_receive_count: int = 3
    cpaas_api_base_url: str = 'https://api-resolve-x.credresolve.com'
    cpaas_api_auth_token: str | None = None
    gemini_api_key: str | None = None
    gemini_model_name: str = "gemini-2.0-flash"

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
    def cors_origins(self) -> list[str]:
        origins: list[str] = []
        for origin in self.cors_allow_origins.split(','):
            cleaned = origin.strip()
            if cleaned:
                origins.append(cleaned)
        return origins


settings = Settings()
