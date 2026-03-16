from __future__ import annotations

import asyncio
import json
import re
import socket
import subprocess
import time
from pathlib import Path
from typing import Any

from jinja2 import Template
from mutagen.mp3 import MP3

from app.config import settings
from app.models import DirectVideoRequest, RemotionVideoRequest

VOICE_MAP = {
    'English': {
        'male': 'en-US-GuyNeural',
        'female': 'en-US-JennyNeural',
    },
    'Hindi': {
        'male': 'hi-IN-MadhurNeural',
        'female': 'hi-IN-SwaraNeural',
    },
    'Marathi': {
        'male': 'mr-IN-ManoharNeural',
        'female': 'mr-IN-AarohiNeural',
    },
    'Tamil': {
        'male': 'ta-IN-ValluvarNeural',
        'female': 'ta-IN-PallaviNeural',
    },
    'Telugu': {
        'male': 'te-IN-MohanNeural',
        'female': 'te-IN-ShrutiNeural',
    },
    'Kannada': {
        'male': 'kn-IN-GaganNeural',
        'female': 'kn-IN-SapnaNeural',
    },
    'Bengali': {
        'male': 'bn-IN-BashkarNeural',
        'female': 'bn-IN-TanishaNeural',
    },
    'Gujarati': {
        'male': 'gu-IN-NiranjanNeural',
        'female': 'gu-IN-DhwaniNeural',
    },
    'Malayalam': {
        'male': 'ml-IN-MidhunNeural',
        'female': 'ml-IN-SobhanaNeural',
    },
    'Punjabi': {
        'male': 'pa-IN-YashpalNeural',
        'female': 'pa-IN-KritikaNeural',
    },
}

DEFAULT_SCRIPT_HI = """नमस्ते {{ customer_name }}।
मैं {{ client_name }} की ओर से आपके {{ product_type }} खाते के संबंध में एक महत्वपूर्ण औपचारिक सूचना साझा कर रही हूँ।
हमारी जानकारी के अनुसार इस खाते की मूल राशि {{ loan_amount }} थी और वर्तमान कुल बकाया राशि {{ tos }} है।
खाता संख्या {{ lan }} पर लंबित भुगतान के बारे में पहले भी सूचित किया गया था, लेकिन स्थिति अभी तक सामान्य नहीं हुई है।
कृपया इस सूचना को गंभीरता से लें और भुगतान अथवा पुनर्भुगतान विकल्प पर चर्चा के लिए तुरंत {{ contact_details }} पर संपर्क करें।
समय पर प्रतिक्रिया देने से आगे की एस्केलेशन से बचने में मदद मिल सकती है।
धन्यवाद।"""

DEFAULT_SCRIPT_EN = """Hello {{ customer_name }}.
I am sharing an important formal notice regarding your {{ product_type }} account on behalf of {{ client_name }}.
As per our records, the principal amount of this account was {{ loan_amount }} and the current total outstanding balance is {{ tos }}.
You were previously notified about the pending payment on account number {{ lan }}, but the status has not returned to normal yet.
Please take this notice seriously and contact {{ contact_details }} immediately to discuss payment or repayment options.
A timely response can help avoid further escalation.
Thank you."""


class RemotionService:
    _single_brace_pattern = re.compile(r'(?<!{){([^{}\s]+)}(?!})')
    _vtt_pattern = re.compile(
        r'(\d{2}:\d{2}:\d{2}[.,]\d{3}) --> (\d{2}:\d{2}:\d{2}[.,]\d{3})\n(.+?)(?=\n\n|\Z)',
        re.DOTALL,
    )
    _allowed_logo_suffixes = {'.png', '.jpg', '.jpeg'}
    _max_logo_bytes = 2 * 1024 * 1024

    def __init__(self, remotion_path: Path | None = None) -> None:
        self.remotion_path = remotion_path or settings.remotion_path
        self.output_dir = settings.output_dir / 'text-videos'

    def _local_remotion_binary(self) -> Path:
        return self.remotion_path / 'node_modules' / '.bin' / 'remotion'

    def _resolve_remotion_command(self) -> list[str]:
        local_binary = self._local_remotion_binary()
        if local_binary.exists():
            return [str(local_binary)]
        return [settings.remotion_npx_binary, 'remotion']

    def _resolve_browser_executable(self) -> str | None:
        configured = settings.remotion_browser_executable
        if configured:
            return configured

        candidates = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
        for candidate in candidates:
            if Path(candidate).exists():
                return candidate
        return None

    def _resolve_renderer_port(self) -> int | None:
        configured = settings.remotion_renderer_port
        if configured is not None:
            return configured

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.bind(('127.0.0.1', 0))
                sock.listen(1)
                return int(sock.getsockname()[1])
        except OSError:
            return None

    def ensure_project_available(self) -> None:
        required_paths = [
            self.remotion_path,
            self.remotion_path / 'package.json',
            self.remotion_path / 'src' / 'index.jsx',
            self.remotion_path / 'public',
        ]
        missing = [path for path in required_paths if not path.exists()]
        if missing:
            missing_display = ', '.join(str(path) for path in missing)
            raise RuntimeError(
                f"Remotion project is incomplete at '{self.remotion_path}'. Missing: {missing_display}."
            )
        if not self._local_remotion_binary().exists():
            raise RuntimeError(
                f"Remotion dependencies are not installed in '{self.remotion_path}'. Run 'npm install' inside the Remotion directory first."
            )

    @staticmethod
    def _public_error_message(raw_error: str, stage: str = 'render') -> str:
        normalized = ' '.join(raw_error.split())
        lowered = normalized.lower()

        if stage == 'audio':
            return 'Audio generation failed for this text video. Please try again in a moment.'

        if (
            'got no response' in lowered
            or 'econnrefused' in lowered
            or 'connection refused' in lowered
            or 'localhost:3000' in lowered
            or '127.0.0.1' in lowered
        ):
            return 'Text video generation failed because the renderer did not respond. Please try again in a moment.'

        if (
            'browser' in lowered
            or 'chrome' in lowered
            or 'chromium' in lowered
            or 'playwright' in lowered
        ) and ('launch' in lowered or 'failed' in lowered or 'executable' in lowered):
            return 'Text video generation failed because the render browser could not start. Please try again in a moment.'

        if 'bundle' in lowered or 'webpack' in lowered or 'vite' in lowered:
            return 'Text video generation failed while preparing the render. Please try again in a moment.'

        return 'Text video generation failed. Please try again in a moment.'

    @classmethod
    def normalize_placeholder_syntax(cls, text: str) -> str:
        return cls._single_brace_pattern.sub(r'{{\1}}', text)

    @staticmethod
    def build_render_context(request: DirectVideoRequest) -> dict[str, Any]:
        customer_name = request.customer_name or 'Customer'
        client_name = request.client_name or 'Bank'
        loan_amount = request.loan_amount or 'amount'
        tos = request.tos or 'outstanding'
        lan = request.lan or 'N/A'
        contact_details = request.contact_details or '1800-555-999'
        product_type = request.product_type or 'loan'
        return {
            'customer_name': customer_name,
            'customer': customer_name,
            'client_name': client_name,
            'client': client_name,
            'loan_amount': loan_amount,
            'loan_amt': loan_amount,
            'amt': loan_amount,
            'tos': tos,
            'balance': tos,
            'outstanding': tos,
            'lan': lan,
            'account_number': lan,
            'contact_details': contact_details,
            'helpline': contact_details,
            'contact': contact_details,
            'product_type': product_type,
            'product': product_type,
        }

    def render_script(self, request: DirectVideoRequest) -> str:
        language = request.language or 'Hindi'
        fallback_script = DEFAULT_SCRIPT_EN if language == 'English' else DEFAULT_SCRIPT_HI
        template_text = request.script_text or fallback_script
        processed_template = self.normalize_placeholder_syntax(template_text)
        template = Template(processed_template)
        rendered = template.render(**self.build_render_context(request))
        return ' '.join(rendered.split())

    @staticmethod
    def _normalize_text(value: Any, fallback: str) -> str:
        if value is None:
            return fallback

        if isinstance(value, (int, float)):
            return str(value)

        cleaned = str(value).strip()
        return cleaned or fallback

    @staticmethod
    def _extract_numeric_amount(value: Any) -> int | None:
        if value is None:
            return None

        if isinstance(value, bool):
            return None

        if isinstance(value, (int, float)):
            return int(round(value))

        cleaned = re.sub(r'[^\d.]', '', str(value))
        if not cleaned:
            return None

        try:
            return int(round(float(cleaned)))
        except ValueError:
            return None

    @staticmethod
    def _format_indian_number(value: int) -> str:
        digits = str(abs(value))
        if len(digits) <= 3:
            grouped = digits
        else:
            grouped = digits[-3:]
            digits = digits[:-3]
            while digits:
                grouped = f'{digits[-2:]},{grouped}'
                digits = digits[:-2]
        return f"-{grouped}" if value < 0 else grouped

    @classmethod
    def format_amount_display(cls, value: Any, fallback: str = 'राशि उपलब्ध नहीं') -> str:
        numeric_value = cls._extract_numeric_amount(value)
        if numeric_value is None:
            cleaned = str(value).strip() if value is not None else ''
            return cleaned or fallback
        return f'₹{cls._format_indian_number(numeric_value)}'

    @classmethod
    def determine_urgency_level(cls, tos: Any) -> str:
        numeric_tos = cls._extract_numeric_amount(tos)
        if numeric_tos is None:
            return 'elevated'
        if numeric_tos >= 100000:
            return 'critical'
        if numeric_tos >= 50000:
            return 'high'
        return 'elevated'

    @staticmethod
    def _product_content(product_type: str, language: str = 'Hindi') -> dict[str, str]:
        normalized = product_type.strip().lower().replace('_', ' ') if product_type else 'loan'
        
        if language == 'English':
            mapping = {
                'loan': {
                    'label': 'Loan Account',
                    'formal': 'Loan Account',
                    'summary': 'Loan Payment Status',
                },
                'insurance': {
                    'label': 'Insurance Account',
                    'formal': 'Insurance Account',
                    'summary': 'Insurance Payment Status',
                },
                'credit card': {
                    'label': 'Credit Card Account',
                    'formal': 'Credit Card Account',
                    'summary': 'Credit Card Status',
                },
            }
            return mapping.get(
                normalized,
                {
                    'label': f'{normalized.title()} Account' if normalized else 'Account',
                    'formal': f'{normalized.title()} Account' if normalized else 'Account',
                    'summary': 'Payment Status',
                },
            )
        else: # Default to Hindi
            mapping = {
                'loan': {
                    'label': 'लोन खाता',
                    'formal': 'ऋण खाते',
                    'summary': 'लोन भुगतान स्थिति',
                },
                'insurance': {
                    'label': 'बीमा खाता',
                    'formal': 'बीमा खाते',
                    'summary': 'बीमा भुगतान स्थिति',
                },
                'credit card': {
                    'label': 'क्रेडिट कार्ड खाता',
                    'formal': 'क्रेडिट कार्ड खाते',
                    'summary': 'क्रेडिट कार्ड स्थिति',
                },
            }
            return mapping.get(
                normalized,
                {
                    'label': f'{normalized.title()} खाता' if normalized else 'खाता',
                    'formal': f'{normalized.title()} खाते' if normalized else 'खाते',
                    'summary': 'भुगतान स्थिति',
                },
            )

    def build_scene_payload(
        self,
        request: DirectVideoRequest,
        display_amounts: dict[str, Any],
        urgency_level: str,
    ) -> dict[str, Any]:
        customer_name = self._normalize_text(request.customer_name, 'Customer')
        client_name = self._normalize_text(request.client_name, 'Bank')
        lan = self._normalize_text(request.lan, 'N/A')
        language = request.language or 'Hindi'
        contact_details = self._normalize_text(request.contact_details, '1800-555-999')
        product_content = self._product_content(self._normalize_text(request.product_type, 'loan'), language=language)
        outstanding_value = display_amounts['primary']['value']
        loan_value = display_amounts['secondary']['value']

        if language == 'English':
            urgency_copy = {
                'critical': 'Immediate Intervention Required',
                'high': 'Rapid Resolution Necessary',
                'elevated': 'Time-Sensitive Formal Notice',
            }[urgency_level]
            secondary_note = (
                f"Principal amount {loan_value}"
                if display_amounts['secondary']['available']
                else 'Payment delay continues as per available records'
            )
            headline_text = f'{customer_name}, immediate attention required on your {product_content["formal"]}'
            cta_text = (
                f'{customer_name}, contact {contact_details} now to discuss resolution and repayment options.'
            )
            
            return {
                'opening': {
                    'eyebrow': 'Formal Notice',
                    'headline': headline_text,
                    'subheadline': f'{client_name} | Account {lan}',
                },
                'account': {
                    'eyebrow': product_content['summary'],
                    'headline': f'Account {lan}',
                    'supporting': f'Current Total Outstanding {outstanding_value}',
                    'badge': urgency_copy,
                },
                'context': {
                    'eyebrow': 'Status Summary',
                    'headline': f'Continued delay recorded in {product_content["label"]}',
                    'body': (
                        f'As per {client_name} records, payment has not been received on time. '
                        f'Total outstanding has reached {outstanding_value} and the situation now requires formal attention.'
                    ),
                },
                'amounts': {
                    'eyebrow': 'Financial Highlights',
                    'headline': 'Amount Summary',
                    'body': secondary_note,
                    'note': 'Please discuss payment or repayment options immediately.',
                },
                'action': {
                    'eyebrow': 'Immediate Next Step',
                    'headline': 'Contact Today',
                    'body': cta_text,
                    'cta_label': 'Contact Number',
                    'cta_value': contact_details,
                },
                'closing': {
                    'eyebrow': 'Resolution Still Possible',
                    'headline': 'A timely response can prevent further escalation',
                    'body': f'{client_name} is awaiting your prompt response.',
                },
                'headline_text': headline_text,
                'cta_text': cta_text,
            }
        else: # Hindi
            urgency_copy = {
                'critical': 'तत्काल हस्तक्षेप आवश्यक',
                'high': 'शीघ्र समाधान आवश्यक',
                'elevated': 'समय-संवेदी औपचारिक सूचना',
            }[urgency_level]
            secondary_note = (
                f"मूल राशि {loan_value}"
                if display_amounts['secondary']['available']
                else 'उपलब्ध अभिलेखों के अनुसार भुगतान विलंब जारी है'
            )
            headline_text = f'{customer_name} जी, आपके {product_content["formal"]} पर तत्काल ध्यान आवश्यक है'
            cta_text = (
                f'{customer_name}, समाधान और पुनर्भुगतान विकल्पों पर बात करने के लिए अभी {contact_details} पर संपर्क करें।'
            )

            return {
                'opening': {
                    'eyebrow': 'औपचारिक सूचना',
                    'headline': headline_text,
                    'subheadline': f'{client_name} | खाता {lan}',
                },
                'account': {
                    'eyebrow': product_content['summary'],
                    'headline': f'खाता {lan}',
                    'supporting': f'वर्तमान कुल बकाया {outstanding_value}',
                    'badge': urgency_copy,
                },
                'context': {
                    'eyebrow': 'स्थिति सारांश',
                    'headline': f'{product_content["label"]} में निरंतर विलंब दर्ज है',
                    'body': (
                        f'{client_name} के रिकॉर्ड के अनुसार भुगतान समय पर नहीं हुआ है। '
                        f'कुल बकाया राशि {outstanding_value} तक पहुंच चुकी है और स्थिति पर अब औपचारिक ध्यान अपेक्षित है।'
                    ),
                },
                'amounts': {
                    'eyebrow': 'वित्तीय मुख्य बिंदु',
                    'headline': 'राशि सारांश',
                    'body': secondary_note,
                    'note': 'कृपया भुगतान या पुनर्भुगतान विकल्प पर तुरंत चर्चा करें।',
                },
                'action': {
                    'eyebrow': 'तत्काल अगला कदम',
                    'headline': 'आज ही संपर्क करें',
                    'body': cta_text,
                    'cta_label': 'संपर्क नंबर',
                    'cta_value': contact_details,
                },
                'closing': {
                    'eyebrow': 'समाधान अभी भी संभव है',
                    'headline': 'समय पर प्रतिक्रिया से आगे की एस्केलेशन टल सकती है',
                    'body': f'{client_name} आपकी त्वरित प्रतिक्रिया की प्रतीक्षा कर रहा है।',
                },
                'headline_text': headline_text,
                'cta_text': cta_text,
            }

    def build_render_payload(
        self,
        request: RemotionVideoRequest,
        job_id: str,
        script_text: str,
        logo_public_path: str | None = None,
    ) -> dict[str, Any]:
        customer_name = self._normalize_text(request.customer_name, 'Customer')
        lan = self._normalize_text(request.lan, 'N/A')
        client_name = self._normalize_text(request.client_name, 'Bank')
        language = self._normalize_text(request.language, 'Hindi')
        contact_details = self._normalize_text(request.contact_details, '1800-555-999')
        product_type = self._normalize_text(request.product_type, 'loan')
        urgency_level = self.determine_urgency_level(request.tos)
        subtitle_enabled = bool(getattr(request, 'include_captions', False))
        subtitle_color = self._normalize_text(getattr(request, 'subtitle_color', 'White'), 'White')
        subtitle_position = self._normalize_text(getattr(request, 'subtitle_position', 'Bottom'), 'Bottom')
        logo_position = self._normalize_text(getattr(request, 'logo_position', 'Top Right'), 'Top Right')
        logo_opacity = int(getattr(request, 'logo_opacity', 80))
        display_amounts = {
            'primary': {
                'label': 'Total Outstanding' if language == 'English' else 'कुल बकाया राशि',
                'value': self.format_amount_display(request.tos, fallback=('Amount N/A' if language == 'English' else 'राशि उपलब्ध नहीं')),
                'raw': self._normalize_text(request.tos, '0'),
                'available': True,
            },
            'secondary': {
                'label': 'Principal Amount' if language == 'English' else 'मूल ऋण राशि',
                'value': self.format_amount_display(request.loan_amount, fallback=('Amount N/A' if language == 'English' else 'राशि उपलब्ध नहीं')),
                'raw': self._normalize_text(request.loan_amount, ''),
                'available': request.loan_amount is not None and str(request.loan_amount).strip() != '',
            },
        }
        scene_payload = self.build_scene_payload(request, display_amounts, urgency_level)

        return {
            'id': job_id,
            'customer_name': customer_name,
            'lan': lan,
            'client_name': client_name,
            'language': language,
            'loan_amount': self._normalize_text(request.loan_amount, ''),
            'tos': self._normalize_text(request.tos, '0'),
            'contact_details': contact_details,
            'product_type': product_type,
            'script_text': script_text,
            'title_prefix': self._normalize_text(request.title_prefix, 'Loan Recall'),
            'display_amounts': display_amounts,
            'scene_payload': scene_payload,
            'headline_text': scene_payload['headline_text'],
            'cta_text': scene_payload['cta_text'],
            'urgency_level': urgency_level,
            'video_width': int(getattr(request, 'video_width', 1280) or 1280),
            'video_height': int(getattr(request, 'video_height', 720) or 720),
            'branding': {
                'subtitles': {
                    'enabled': subtitle_enabled,
                    'color': subtitle_color,
                    'position': subtitle_position,
                },
                'logo': {
                    'public_path': logo_public_path,
                    'position': logo_position,
                    'opacity': logo_opacity,
                },
            },
        }

    @staticmethod
    def _time_to_seconds(value: str) -> float:
        normalized = value.replace(',', '.')
        hours, minutes, seconds = normalized.split(':')
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)

    def parse_vtt(self, vtt_path: Path) -> list[dict[str, Any]]:
        if not vtt_path.exists():
            return []

        content = vtt_path.read_text(encoding='utf-8')
        subtitles: list[dict[str, Any]] = []
        for start, end, text in self._vtt_pattern.findall(content):
            subtitles.append(
                {
                    'text': ' '.join(text.split()),
                    'start': self._time_to_seconds(start),
                    'end': self._time_to_seconds(end),
                }
            )
        return subtitles

    def _audio_dir(self) -> Path:
        return self.remotion_path / 'public' / 'audio'

    def _metadata_path(self) -> Path:
        return self.remotion_path / 'public' / 'metadata.json'

    def _logo_public_dir(self) -> Path:
        return self.remotion_path / 'public' / 'logos'

    def _persist_logo_asset(
        self,
        job_id: str,
        filename: str | None,
        logo_bytes: bytes | None,
    ) -> str | None:
        if not logo_bytes:
            return None

        if len(logo_bytes) > self._max_logo_bytes:
            raise ValueError('Logo file exceeds the 2MB upload limit.')

        suffix = Path(filename or 'logo.png').suffix.lower() or '.png'
        if suffix not in self._allowed_logo_suffixes:
            raise ValueError('Unsupported logo format. Use a PNG or JPG image.')

        logo_dir = self._logo_public_dir()
        logo_dir.mkdir(parents=True, exist_ok=True)
        logo_path = logo_dir / f'{job_id}{suffix}'
        logo_path.write_bytes(logo_bytes)
        return f'logos/{logo_path.name}'

    async def generate_tts(self, request: DirectVideoRequest) -> dict[str, Any]:
        self.ensure_project_available()

        audio_dir = self._audio_dir()
        audio_dir.mkdir(parents=True, exist_ok=True)
        metadata_path = self._metadata_path()
        self.output_dir.mkdir(parents=True, exist_ok=True)

        language = request.language or 'Hindi'
        gender = request.voice_gender or 'female'
        voice_config = VOICE_MAP.get(language, VOICE_MAP['Hindi'])
        voice = voice_config.get(gender, voice_config.get('female'))
        text_content = self.render_script(request)
        job_id = f'{request.lan}_{int(time.time())}'
        audio_file = audio_dir / f'{job_id}.mp3'
        vtt_file = audio_dir / f'{job_id}.vtt'
        temp_text_file = self.remotion_path / 'public' / f'temp_{job_id}.txt'
        temp_text_file.write_text(text_content, encoding='utf-8')

        try:
            full_command = f'"{settings.edge_tts_binary}" --file "{temp_text_file}" --voice "{voice}" --write-media "{audio_file}" --write-subtitles "{vtt_file}"'
            print(f"DEBUG: Running edge-tts-sync: {full_command}")
            
            def run_tts():
                import subprocess
                return subprocess.run(full_command, shell=True, capture_output=True, text=True)

            process_result = await asyncio.to_thread(run_tts)
            
            if process_result.returncode != 0:
                error_detail = process_result.stderr.strip()
                print(f'ERROR: Edge TTS failed for {job_id}: {error_detail}')
                raise RuntimeError(self._public_error_message(error_detail, stage='audio'))

            duration = MP3(str(audio_file)).info.length
            subtitles = self.parse_vtt(vtt_file)
            metadata: dict[str, Any] = {}
            if metadata_path.exists():
                try:
                    metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
                except json.JSONDecodeError:
                    metadata = {}

            metadata[job_id] = {
                'duration': duration,
                'subtitles': subtitles,
                'tts_provider': 'edge-tts',
            }
            metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding='utf-8')
            return {
                'job_id': job_id,
                'audio_path': audio_file,
                'subtitle_path': vtt_file,
                'text': text_content,
            }
        finally:
            if temp_text_file.exists():
                temp_text_file.unlink()

    async def render_video(self, request: RemotionVideoRequest, job_id: str, script_text: str) -> Path:
        self.ensure_project_available()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        command_prefix = self._resolve_remotion_command()
        browser_executable = self._resolve_browser_executable()
        renderer_port = self._resolve_renderer_port()
        logo_public_path = self._persist_logo_asset(job_id, request.logo_filename, request.logo_bytes)
        leads_path = self.remotion_path / 'leads.json'
        leads: list[dict[str, Any]] = []
        if leads_path.exists():
            try:
                loaded = json.loads(leads_path.read_text(encoding='utf-8'))
                if isinstance(loaded, list):
                    leads = [item for item in loaded if isinstance(item, dict)]
            except json.JSONDecodeError:
                leads = []

        leads = [lead for lead in leads if lead.get('id') != job_id]
        leads.append(self.build_render_payload(request, job_id, script_text, logo_public_path))
        leads_path.write_text(
            json.dumps(leads, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )

        output_path = self.output_dir / f'{job_id}.mp4'
        base_args = [
            'render',
            'src/index.jsx',
        ]
        shared_flags = ['--overwrite']
        if settings.remotion_force_ipv4:
            shared_flags.append('--ipv4')
        if renderer_port is not None:
            shared_flags.extend(['--port', str(renderer_port)])
        if browser_executable:
            shared_flags.extend(['--browser-executable', browser_executable])

        primary_command = command_prefix + base_args + [
            job_id.replace('_', '-'),
            str(output_path),
        ] + shared_flags
        fallback_command = command_prefix + base_args + [
            'main',
            str(output_path),
            '--props',
            json.dumps({'leadId': job_id}),
        ] + shared_flags

        last_error = ''
        for command in (primary_command, fallback_command):
            process = await asyncio.create_subprocess_exec(
                *command,
                cwd=str(self.remotion_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()
            if process.returncode == 0:
                return output_path
            error_parts = [part.strip() for part in (stderr.decode(), stdout.decode()) if part.strip()]
            last_error = '\n'.join(error_parts)

        print(f'ERROR: Remotion render failed for {job_id}: {last_error}')
        raise RuntimeError(self._public_error_message(last_error, stage='render'))

    async def generate_video(self, request: RemotionVideoRequest) -> dict[str, Any]:
        tts_result = await self.generate_tts(request)
        video_path = await self.render_video(request, tts_result['job_id'], tts_result['text'])
        return {
            'job_id': tts_result['job_id'],
            'video_path': video_path,
            'audio_path': tts_result['audio_path'],
            'text': tts_result['text'],
        }
