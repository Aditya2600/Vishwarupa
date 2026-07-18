import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import jinja2
try:
    from mutagen.mp3 import MP3
except ImportError:
    MP3 = None

from app.config import settings
from app.models import RemotionVideoRequest
from datetime import datetime
from app.utils.text_utils import normalize_hindi_numbers

logger = logging.getLogger(__name__)


def _tail(text: str | bytes | None, limit: int = 4000) -> str:
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="ignore")
    return (text or "").strip()[-limit:]


VOICE_MAP = {
    "English-Male": "en-US-GuyNeural",
    "English-Female": "en-US-AriaNeural",
    "Hindi-Male": "hi-IN-MadhurNeural",
    "Hindi-Female": "hi-IN-SwaraNeural",
    "Marathi-Male": "mr-IN-ManoharNeural",
    "Marathi-Female": "mr-IN-AarohiNeural",
    "Tamil-Male": "ta-IN-ValluvarNeural",
    "Tamil-Female": "ta-IN-PallaviNeural",
    "Telugu-Male": "te-IN-MohanNeural",
    "Telugu-Female": "te-IN-ShrutiNeural",
    "Kannada-Male": "kn-IN-GaganNeural",
    "Kannada-Female": "kn-IN-SapnaNeural",
    "Bengali-Male": "bn-IN-BashkarNeural",
    "Bengali-Female": "bn-IN-TanishaaNeural",
    "Gujarati-Male": "gu-IN-NiranjanNeural",
    "Gujarati-Female": "gu-IN-DhwaniNeural",
    "Malayalam-Male": "ml-IN-MidhunNeural",
    "Malayalam-Female": "ml-IN-SobhanaNeural",
    "Punjabi-Male": "pa-IN-OjasNeural",
    "Punjabi-Female": "pa-IN-VaaniNeural",
}

DEFAULT_SCRIPT_EN = "Hello {{ customer_name }}. I am calling from {{ client_name }} regarding your {{ product_type }} account. The total outstanding balance is {{ tos }}. Please contact us at {{ contact_details }} to discuss repayment options."
DEFAULT_SCRIPT_HI = "नमस्ते {{ customer_name }}। मैं {{ client_name }} से आपके {{ product_type }} खाते के संबंध में बोल रही हूँ। आपकी कुल बकाया राशि {{ tos }} है। कृपया भुगतान विकल्पों पर चर्चा करने के लिए हमसे {{ contact_details }} पर संपर्क करें।"
DEFAULT_LOAN_OFFER_EN = "Congratulations {{ customer_name }}. Your pre-approved loan offer from {{ client_name }} is ready. Tap Continue to view your exclusive offer. You can choose a loan amount up to {{ loan_amount }} with flexible tenure options. Now, choose your preferred loan amount and tenure, then tap Proceed. Finally, tap Call to connect with our team."
DEFAULT_LOAN_OFFER_HI = "बधाई हो {{ customer_name }}। {{ client_name }} की तरफ से आपका प्री-अप्रूव्ड लोन ऑफर तैयार है। अपना एक्सक्लूसिव ऑफर देखने के लिए Continue दबाएं। आप {{ loan_amount }} तक की राशि चुन सकते हैं। अब, अपनी पसंद की लोन राशि और अवधि चुनकर Proceed करें। किसी भी सहायता के लिए Call करें।"
DEFAULT_SCENE_LOAN_OFFER_HI = """पैसों की परेशानी से जूझ रहे हैं? अब चिंता छोड़िए।
बधाई हो! आपके लिए एक खास प्री-अप्रूव्ड लोन ऑफर तैयार है।
नया बाइक हो, ज़रूरी खर्च हो या आपके सपने, अब सब होगा आसान।
अपनी जरूरत के हिसाब से आसान लोन विकल्प चुनना अब और भी सरल है।
तेज़ प्रोसेस, कम दस्तावेज़ और भरोसेमंद सहायता।
हर कदम पर हमारी टीम आपके साथ है।
अपने सपनों को आगे बढ़ाइए और बेहतर कल की शुरुआत कीजिए।
आपका प्री-अप्रूव्ड ऑफर आपका इंतज़ार कर रहा है।"""

LOAN_REMINDER_DEFAULT_ASSETS = {
    "logo": "assets/tvs_credit_logo.png",
    "npaWarning": "man_phone_transparent.png",
    "creditImpact": "credit_score_transparent.png",
    "lastChance": "last_chance_transparent.png",
    "ctaScene": "phone_paynow_transparent.png",
    "financialBurden": "piggy_bank_arrow_transparent.png",
}

SALES_TEMPLATE_DEFAULT_ASSETS = {
    "scene1": "scene1.png",
    "scene2": "scene2.png",
    "scene3": "scene3.png",
    "scene4": "scene4.png",
    "scene5": "scene5.png",
}

EMI_TEMPLATE_DEFAULT_ASSETS = {
    "whatsappPaynow": "paynow_whatsapp.png",
    "smsLink": "link_sms.png",
    "upiApps": "upi_app.png",
    "openappSearch": "open_app_search.png",
    "enterlan": "enter_lan.png",
    "paymentSuccess": "payment_success.png",
    "shopVisit": "shop_visit.png",
}

EMI_TEMPLATE_ASSET_ALIASES = {
    "whatsapp_pay_now.png": "paynow_whatsapp.png",
    "whatsapp_pay_now": "paynow_whatsapp.png",
    "sms_link.png": "link_sms.png",
    "sms link.png": "link_sms.png",
    "upi_apps.png": "upi_app.png",
    "upi apps.png": "upi_app.png",
    "openapp_and serach tvs credit.png": "open_app_search.png",
    "openapp_and_search_tvs_credit.png": "open_app_search.png",
    "open_app_and_search.png": "open_app_search.png",
    "enterlan.png": "enter_lan.png",
    "payment sucess.png": "payment_success.png",
    "payment_success_image.png": "payment_success.png",
    "payment_success_image": "payment_success.png",
    "shopvisit.png": "shop_visit.png",
}


def service_entry_composition(template_key: str | None) -> tuple[str, str]:
    """Map a template_key to its (entry_point, composition_id) for the renderer
    service. Mirrors the CLI's `npx remotion render <entry> <composition>` routing."""
    if template_key == "loan_reminder":
        return "src/Root.tsx", "LoanReminderVideo"
    if template_key == "collection_reminder":
        return "src/Root.tsx", "CollectionReminderVideo"
    if template_key == "tvs_credit_emi":
        return "src/index.jsx", "TVSCreditEMITemplate"
    if template_key == "scene_loan_offer":
        return "src/index.jsx", "SceneLoanOfferVideo"
    return "src/index.jsx", "main"


def _ensure_remotion_runtime_files(remotion_path: Path) -> None:
    leads_path = remotion_path / "leads.json"
    metadata_path = remotion_path / "public" / "metadata.json"

    if not leads_path.exists():
        leads_path.write_text("[]\n", encoding="utf-8")
    if not metadata_path.exists():
        metadata_path.parent.mkdir(parents=True, exist_ok=True)
        metadata_path.write_text("{}\n", encoding="utf-8")


def _prepare_tts_pronunciation(text: str, lan: str | None = None) -> str:
    # Keep the brand spelling in scripts/subtitles, but guide TTS to say "PhonePay".
    text = re.sub(r'\bPhonePe\b', 'PhonePay', text, flags=re.IGNORECASE)
    
    if lan:
        lan_clean = str(lan).strip()
        if lan_clean and lan_clean != "N/A":
            # Match the exact loan number (case-sensitively) as a word token and space its characters
            spaced_lan = " ".join(list(lan_clean))
            escaped_lan = re.escape(lan_clean)
            text = re.sub(rf'\b{escaped_lan}\b', spaced_lan, text)
            
    return text


def _strip_timestamp_markers(text: str) -> str:
    return re.sub(r'^\s*\(\d{1,2}:\d{2}(?::\d{2})?\)\s*', '', text, flags=re.MULTILINE).strip()


def _clean_scene_sales_script(text: str) -> str:
    text = _strip_timestamp_markers(text)
    text = re.sub(r'^\s*[\d०-९]+[\).:-]?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'[\d०-९]+', '', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return '\n'.join(line.strip() for line in text.splitlines() if line.strip())


def _restore_display_spellings(text: str, lan: str | None = None) -> str:
    text = re.sub(r'\bPhonePay\b', 'PhonePe', text, flags=re.IGNORECASE)
    
    # Generic restore: collapse space-separated digits (2 or more) back into a single number
    text = re.sub(r'\b\d(?:\s+\d)+\b', lambda m: m.group(0).replace(" ", ""), text)
    
    # Precise restore: if lan was spaced out, replace its spaced representation back to normal
    if lan:
        lan_clean = str(lan).strip()
        if lan_clean and lan_clean != "N/A":
            spaced_lan = " ".join(list(lan_clean))
            text = text.replace(spaced_lan, lan_clean)
            
    return text

class RemotionService:
    def __init__(self):
        self.remotion_path = settings.remotion_path
        self.public_path = self.remotion_path / "public"
        self.assets_path = self.public_path / "assets"
        self.assets_path.mkdir(parents=True, exist_ok=True)
        # Support both . and , as millisecond separators since edge-tts uses commas (SRT style)
        self.vtt_pattern = re.compile(r'(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*(.+?)(?=\n\d{2}:\d{2}|$)', re.DOTALL)
        
    def _safe_asset_filename(self, filename: str) -> str:
        stem = Path(filename or "asset.png").name
        return re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-") or "asset.png"

    def _normalize_emi_asset_path(self, value: str) -> str:
        clean_value = str(value or "").strip()
        if not clean_value:
            return clean_value

        clean_path = clean_value.replace("\\", "/")
        prefix = ""
        if "/" in clean_path:
            prefix = clean_path.rsplit("/", 1)[0] + "/"
        filename = Path(clean_path).name
        normalized_filename = EMI_TEMPLATE_ASSET_ALIASES.get(filename.lower(), filename)
        return f"{prefix}{normalized_filename}" if prefix else normalized_filename

    async def _persist_loan_reminder_assets(self, request: RemotionVideoRequest, video_id: str) -> dict[str, str]:
        assets = {
            **LOAN_REMINDER_DEFAULT_ASSETS,
            **(request.loan_reminder_image_paths or {}),
        }

        upload_bytes = request.loan_reminder_image_bytes or {}
        upload_names = request.loan_reminder_image_filenames or {}
        if upload_bytes:
            target_dir = self.assets_path / "generated" / "loan-reminder" / video_id
            target_dir.mkdir(parents=True, exist_ok=True)
            for key, content in upload_bytes.items():
                if key not in LOAN_REMINDER_DEFAULT_ASSETS or not content:
                    continue
                safe_name = self._safe_asset_filename(upload_names.get(key) or f"{key}.png")
                target_name = f"{key}-{safe_name}"
                (target_dir / target_name).write_bytes(content)
                assets[key] = f"assets/generated/loan-reminder/{video_id}/{target_name}"

        if request.logo_filename and "logo" not in upload_bytes:
            assets["logo"] = f"assets/{request.logo_filename}"

        return assets

    async def _persist_sales_template_assets(self, request: RemotionVideoRequest, video_id: str) -> dict[str, str]:
        assets = {
            **SALES_TEMPLATE_DEFAULT_ASSETS,
            **(request.sales_image_paths or {}),
        }

        upload_bytes = request.sales_image_bytes or {}
        upload_names = request.sales_image_filenames or {}
        if upload_bytes:
            target_dir = self.assets_path / "generated" / "sales-template" / video_id
            target_dir.mkdir(parents=True, exist_ok=True)
            for key, content in upload_bytes.items():
                if key not in SALES_TEMPLATE_DEFAULT_ASSETS or not content:
                    continue
                safe_name = self._safe_asset_filename(upload_names.get(key) or f"{key}.png")
                target_name = f"{key}-{safe_name}"
                (target_dir / target_name).write_bytes(content)
                assets[key] = f"assets/generated/sales-template/{video_id}/{target_name}"

        return assets

    async def _persist_emi_template_assets(self, request: RemotionVideoRequest, video_id: str) -> dict[str, str]:
        assets = {
            **EMI_TEMPLATE_DEFAULT_ASSETS,
            **{
                key: self._normalize_emi_asset_path(value)
                for key, value in (request.emi_image_paths or {}).items()
            },
        }

        upload_bytes = request.emi_image_bytes or {}
        upload_names = request.emi_image_filenames or {}
        if upload_bytes:
            target_dir = self.assets_path / "generated" / "emi-template" / video_id
            target_dir.mkdir(parents=True, exist_ok=True)
            for key, content in upload_bytes.items():
                if key not in EMI_TEMPLATE_DEFAULT_ASSETS or not content:
                    continue
                safe_name = self._safe_asset_filename(upload_names.get(key) or f"{key}.png")
                target_name = f"{key}-{safe_name}"
                (target_dir / target_name).write_bytes(content)
                assets[key] = f"assets/generated/emi-template/{video_id}/{target_name}"

        return assets

    def build_loan_reminder_props(
        self,
        request: RemotionVideoRequest,
        audio_path: str | None,
        loan_reminder_assets: dict[str, str],
    ) -> dict[str, Any]:
        return {
            "customerName": request.customer_name or "Customer",
            "loanType": request.product_type or "Personal Loan",
            "loanNumber": request.lan or "N/A",
            "overdueAmount": str(request.tos or "0"),
            "lenderName": request.client_name or "TVS Credit",
            "voiceoverLanguage": "loan_reminder",
            "voiceoverAudioSrc": audio_path.lstrip("/") if audio_path else None,
            "loanReminderAssets": loan_reminder_assets,
        }

    def build_collection_reminder_props(
        self,
        request: RemotionVideoRequest,
        audio_path: str | None,
    ) -> dict[str, Any]:
        lan_digits = re.sub(r"\D+", "", str(request.lan or ""))
        account_last4 = lan_digits[-4:] if lan_digits else str(request.lan or "1234")[-4:]

        return {
            "customerName": request.customer_name or "Customer",
            "bankName": "TVS Credit",
            "productType": request.product_type or "Loan",
            "accountLast4": account_last4 or "1234",
            "overdueAmount": str(request.tos or "₹0"),
            "minimumDue": str(request.max_emi or request.tos or "₹0"),
            "totalDue": str(request.loan_amount or request.tos or "₹0"),
            "daysOverdue": request.days_overdue if request.days_overdue is not None else 12,
            "npaDays": 90,
            "bankerName": "Banker",
            "bankerPhone": request.contact_details or "",
            "payNowLabel": "Pay Now",
            "callUsLabel": "Call Us",
            "brandColor": request.primary_color or "#005baa",
            "accentColor": request.secondary_color or "#0a9d58",
            "logoPath": "assets/tvs_credit_logo.png",
            "voiceoverAudioPath": audio_path.lstrip("/") if audio_path else None,
        }


    def _product_content(self, product_type: str, language: str) -> dict[str, str]:
        translations = {
            'loan': {
                'English': {'label': 'Loan', 'formal': 'Loan Account', 'summary': 'Loan Payment Status'},
                'Hindi': {'label': 'लोन', 'formal': 'ऋण खाता', 'summary': 'लोन भुगतान स्थिति'},
                'Marathi': {'label': 'कर्ज', 'formal': 'कर्ज खाते', 'summary': 'कर्ज पेमेंट स्थिती'},
                'Tamil': {'label': 'கடன்', 'formal': 'கடன் கணக்கு', 'summary': 'கடன் செலுத்தும் நிலை'},
                'Telugu': {'label': 'రుణం', 'formal': 'రుణ ఖాతా', 'summary': 'రుణ చెల్లింపు స్థితి'},
                'Kannada': {'label': 'ಸಾಲ', 'formal': 'ಸಾಲದ ಖಾತೆ', 'summary': 'ಸಾಲ ಪಾವತಿ ಸ್ಥಿತಿ'},
                'Bengali': {'label': 'ঋণ', 'formal': 'ঋণ অ্যাকাউন্ট', 'summary': 'ঋণ পরিশোধের স্থিতি'},
                'Gujarati': {'label': 'લોન', 'formal': 'લોન ખાતું', 'summary': 'લોન ચુકવણીની સ્થિતિ'},
                'Malayalam': {'label': 'വായ്പ', 'formal': 'വായ്പ అക്കൗണ്ട്', 'summary': 'വായ്പ തിരിച്ചടവ് നില'},
                'Punjabi': {'label': 'ਕਰਜ਼ਾ', 'formal': 'ਕਰਜ਼ਾ ਖਾਤਾ', 'summary': 'ਕਰਜ਼ਾ ਭੁਗਤਾਨ ਸਥਿਤੀ'}
            },
            'credit_card': {
                'English': {'label': 'Credit Card', 'formal': 'Credit Card Account', 'summary': 'Card Payment Status'},
                'Hindi': {'label': 'क्रेडिट कार्ड', 'formal': 'क्रेडिट कार्ड खाता', 'summary': 'कार्ड भुगतान स्थिति'},
                'Marathi': {'label': 'क्रेडिट कार्ड', 'formal': 'क्रेडिट कार्ड खाते', 'summary': 'कार्ड पेमेंट स्थिती'},
                'Tamil': {'label': 'கிரெடிட் கார்டு', 'formal': 'கிரெடிட் கார்டு கணக்கு', 'summary': 'கார்டு செலுத்தும் நிலை'},
                'Telugu': {'label': 'క్రెడిట్ కార్డ్', 'formal': 'క్రెడిట్ కార్డ్ ఖాతా', 'summary': 'కార్డ్ చెల్లింపు స్థితి'},
                'Kannada': {'label': 'ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್', 'formal': 'ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್ ಖಾತೆ', 'summary': 'ಕಾರ್ಡ್ ಪಾವತಿ ಸ್ಥಿತಿ'},
                'Bengali': {'label': 'ক্রেডিট কার্ড', 'formal': 'ক্রেডিট কার্ড অ্যাকাউন্ট', 'summary': 'কার্ড পরিশোধের স্থಿತಿ'},
                'Gujarati': {'label': 'ક્રેડિટ કાર્ડ', 'formal': 'ક્રેડિટ કાર્ડ ખાતું', 'summary': 'કાર્ડ ચુકવણીની સ્થિતિ'},
                'Malayalam': {'label': 'ക്രെഡിറ്റ് കാർഡ്', 'formal': 'ക്രെഡിറ്റ് കാർഡ് അക്കൗണ്ട്', 'summary': 'കാർഡ് തിരിച്ചടവ് നില'},
                'Punjabi': {'label': 'ਕ੍ਰੈਡਿਟ ਕਾਰਡ', 'formal': 'ਕ੍ਰੈਡਿਟ ਕਾਰਡ ਖਾਤਾ', 'summary': 'ਕਾਰਡ ਭੁਗਤਾਨ ਸਥਿਤੀ'}
            }
        }
        fallback = {'label': 'Account', 'formal': 'Account', 'summary': 'Status Summary'}
        product_map = translations.get(product_type, translations['loan'])
        return product_map.get(language, product_map['English'])

    async def generate_tts(self, request: RemotionVideoRequest, video_id: str | None = None) -> dict[str, Any]:
        voice_gender = (request.voice_gender or "female").lower()
        effective_video_id = video_id or f"{request.language or 'remotion'}_{int(time.time())}"
        
        output_filename = f"{effective_video_id}.mp3"
        # Save to public/audio as expected by TemplateVideo.jsx
        audio_dir = self.remotion_path / "public" / "audio"
        audio_dir.mkdir(exist_ok=True)
        audio_file = audio_dir / output_filename
        vtt_file = self.assets_path / f"{effective_video_id}.vtt"
        
        voice_key = f"{request.language or 'Hindi'}-{voice_gender.capitalize()}"
        voice = VOICE_MAP.get(voice_key, VOICE_MAP.get("Hindi-Female"))
        
        is_universal = (request.video_variety or "personalized") == "universal"

        if request.template_key == 'loan_offer_interactive':
            raw_script = request.script_text or (DEFAULT_LOAN_OFFER_HI if request.language == "Hindi" else DEFAULT_LOAN_OFFER_EN)
        elif request.template_key == 'scene_loan_offer':
            raw_script = request.script_text or DEFAULT_SCENE_LOAN_OFFER_HI
        else:
            raw_script = request.script_text or (DEFAULT_SCRIPT_HI if request.language == "Hindi" else DEFAULT_SCRIPT_EN)

        if is_universal:
            # Universal transcripts have no placeholders — use the text verbatim
            # to avoid Jinja errors when customer fields are empty.
            script_text = raw_script
        else:
            template = jinja2.Template(raw_script)
            script_text = template.render(
                customer_name=request.customer_name,
                client_name=request.client_name,
                product_type=request.product_type,
                tos=request.tos,
                loan_amount=request.loan_amount,
                lan=request.lan,
                contact_details=request.contact_details,
            )
        
        if request.template_key == 'scene_loan_offer':
            script_text = _clean_scene_sales_script(script_text)

        tts_text = _prepare_tts_pronunciation(script_text, request.lan)
        if request.language == "Hindi":
            tts_text = normalize_hindi_numbers(tts_text)
            logger.info(f"TTS Output: {tts_text}")

        import tempfile
        import os
        
        # Use a temporary file for the text to avoid shell quoting issues
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8') as f:
            f.write(tts_text)
            temp_text_file = f.name

        import sys
        command = f'"{sys.executable}" -m edge_tts --voice "{voice}" --file "{temp_text_file}" --write-media "{audio_file}" --write-subtitles "{vtt_file}"'
        
        def run_tts():
            import subprocess
            import tempfile
            with tempfile.NamedTemporaryFile() as out_f, tempfile.NamedTemporaryFile() as err_f:
                try:
                    result = subprocess.run(
                        command,
                        shell=True,
                        stdout=out_f,
                        stderr=err_f,
                        stdin=subprocess.DEVNULL,
                        timeout=settings.edge_tts_timeout_seconds,
                    )
                except subprocess.TimeoutExpired as exc:
                    out_f.seek(0)
                    err_f.seek(0)
                    stdout_text = out_f.read().decode('utf-8', errors='ignore')
                    stderr_text = err_f.read().decode('utf-8', errors='ignore')
                    raise Exception(
                        f"TTS timed out after {settings.edge_tts_timeout_seconds}s. "
                        f"stdout={_tail(stdout_text)!r} stderr={_tail(stderr_text)!r}"
                    ) from exc
                out_f.seek(0)
                err_f.seek(0)
                stdout_text = out_f.read().decode('utf-8', errors='ignore')
                stderr_text = err_f.read().decode('utf-8', errors='ignore')
                if result.returncode != 0:
                    logger.error(f"TTS Process Error: {stderr_text}")
                    raise Exception(f"TTS Error: stdout={_tail(stdout_text)!r} stderr={_tail(stderr_text)!r}")
                return result

        try:
            result_process = await asyncio.to_thread(run_tts)

            # Give a small buffer for file to be finalized on disk
            for _ in range(10):
                if audio_file.exists():
                    break
                await asyncio.sleep(0.1)

            if not audio_file.exists():
                raise Exception(f"TTS file {audio_file} was not created by edge-tts")

            if vtt_file.exists():
                vtt_file.write_text(_restore_display_spellings(vtt_file.read_text(encoding='utf-8'), request.lan), encoding='utf-8')

        finally:
            if os.path.exists(temp_text_file):
                try:
                    os.remove(temp_text_file)
                except Exception:
                    pass
            
        duration = 0.0
        if MP3 is not None:
            try:
                audio_meta = MP3(audio_file)
                if audio_meta.info is not None:
                    duration = audio_meta.info.length
            except Exception as e:
                logger.error(f"Failed to read audio duration using mutagen: {e}")
        
        # Fallback to ffprobe if mutagen is missing or fails
        if duration == 0.0:
            try:
                cmd = [
                    "ffprobe", 
                    "-v", "quiet", 
                    "-print_format", "json", 
                    "-show_format", 
                    str(audio_file)
                ]
                res = subprocess.run(cmd, capture_output=True, text=True, check=True)
                data = json.loads(res.stdout)
                duration = float(data.get("format", {}).get("duration", 0.0))
            except Exception as e:
                logger.error(f"Fallback ffprobe duration check failed: {e}")

        return {
            "video_id": video_id,
            "audio_path": f"/audio/{video_id}.mp3",
            "full_audio_path": str(audio_file),
            "vtt_path": vtt_file,
            "duration": duration,
            "text": script_text
        }

    def build_universal_scene_payload(self, request: RemotionVideoRequest) -> dict[str, Any]:
        """Build a generic, non-personalised scene payload for universal mode."""
        t = {
            'English': {
                'notice': 'Formal Notice',
                'eyebrow': 'Account Update',
                'headline': 'Important Account Notice',
                'subheadline': 'Please review this communication carefully',
                'account_eyebrow': 'Account Status',
                'account_headline': 'Account Review Required',
                'account_supporting': 'Outstanding balance remains unresolved',
                'account_badge': 'Attention Required',
                'context_eyebrow': 'Status Summary',
                'context_headline': 'Payment overdue on account',
                'context_body': 'Our records indicate that the outstanding balance has not been resolved. Immediate attention is required.',
                'amounts_eyebrow': 'Financial Summary',
                'amounts_headline': 'Amount Summary',
                'amounts_body': 'Payment delay continues to be on record',
                'amounts_note': 'Please contact us to discuss repayment options.',
                'action_eyebrow': 'Next Step',
                'action_headline': 'Contact Us Today',
                'action_body': 'Please reach out to our office immediately to discuss a suitable repayment arrangement.',
                'action_cta_label': 'Call Now',
                'closing_eyebrow': 'Resolution',
                'closing_headline': 'A timely response helps avoid further escalation',
                'closing_body': 'Our team is ready to assist you with a suitable resolution.',
                'ui': {'formalNotice': 'Formal Notice', 'accountStatus': 'Account Status', 'financialHighlights': 'Financial Highlights', 'immediateNextStep': 'Next Step', 'resolutionStillPossible': 'Possible Solution', 'customerLabel': 'Customer', 'clientLabel': 'Client', 'productLabel': 'Product', 'outstandingLabel': 'Outstanding', 'finalSummary': 'Summary', 'contactLabel': 'Contact'}
            },
            'Hindi': {
                'notice': 'औपचारिक सूचना',
                'eyebrow': 'खाता अपडेट',
                'headline': 'महत्वपूर्ण खाता सूचना',
                'subheadline': 'कृपया इस संचार को ध्यान से पढ़ें',
                'account_eyebrow': 'खाता स्थिति',
                'account_headline': 'खाते की समीक्षा आवश्यक',
                'account_supporting': 'लंबित बकाया राशि अभी तक हल नहीं हुई',
                'account_badge': 'ध्यान आवश्यक',
                'context_eyebrow': 'स्थिति सारांश',
                'context_headline': 'खाते पर भुगतान लंबित है',
                'context_body': 'हमारी जानकारी के अनुसार बकाया राशि अभी तक हल नहीं हुई है। तत्काल ध्यान आवश्यक है।',
                'amounts_eyebrow': 'वित्तीय सारांश',
                'amounts_headline': 'राशि सारांश',
                'amounts_body': 'भुगतान विलंब अभी भी दर्ज है',
                'amounts_note': 'कृपया पुनर्भुगतान विकल्पों पर चर्चा के लिए हमसे संपर्क करें।',
                'action_eyebrow': 'तत्काल अगला कदम',
                'action_headline': 'आज ही संपर्क करें',
                'action_body': 'उचित पुनर्भुगतान व्यवस्था पर चर्चा के लिए कृपया तुरंत हमारे कार्यालय से संपर्क करें।',
                'action_cta_label': 'अभी कॉल करें',
                'closing_eyebrow': 'समाधान',
                'closing_headline': 'समय पर प्रतिक्रिया आगे की कार्रवाई से बचने में मदद करती है',
                'closing_body': 'हमारी टीम उचित समाधान में आपकी सहायता के लिए तैयार है।',
                'ui': {'formalNotice': 'औपचारिक सूचना', 'accountStatus': 'खाता स्थिति', 'financialHighlights': 'वित्तीय मुख्य बिंदु', 'immediateNextStep': 'तत्काल अगला कदम', 'resolutionStillPossible': 'समाधान अभी भी संभव है', 'customerLabel': 'ग्राहक', 'clientLabel': 'बैंक', 'productLabel': 'उत्पाद', 'outstandingLabel': 'कुल बकाया', 'finalSummary': 'अंतिम सारांश', 'contactLabel': 'संपर्क'}
            },
        }
        lang = request.language if request.language in t else 'English'
        s = t[lang]
        contact = request.contact_details or ''
        return {
            'opening': {'eyebrow': s['notice'], 'headline': s['headline'], 'subheadline': s['subheadline']},
            'account': {'eyebrow': s['account_eyebrow'], 'headline': s['account_headline'], 'supporting': s['account_supporting'], 'badge': s['account_badge']},
            'context': {'eyebrow': s['context_eyebrow'], 'headline': s['context_headline'], 'body': s['context_body']},
            'amounts': {'eyebrow': s['amounts_eyebrow'], 'headline': s['amounts_headline'], 'body': s['amounts_body'], 'note': s['amounts_note']},
            'action': {'eyebrow': s['action_eyebrow'], 'headline': s['action_headline'], 'body': str(s['action_body']) + (f' {contact}' if contact else ''), 'cta_label': s['action_cta_label'], 'cta_value': contact},
            'closing': {'eyebrow': s['closing_eyebrow'], 'headline': s['closing_headline'], 'body': s['closing_body']},
            'headline_text': s['headline'],
            'cta_text': s['action_body'],
            'ui_copy': s.get('ui', t['English']['ui'])
        }

    def build_scene_payload(self, request: RemotionVideoRequest, outstanding_value: str, loan_value: str, urgency_level: str) -> dict[str, Any]:
        if request.template_key == 'payment_guidance':
            return self.build_payment_guidance_scene_payload(request, outstanding_value, loan_value)
        if request.template_key == 'overdue_template':
            return self.build_overdue_scene_payload(request, outstanding_value, loan_value)
        if request.template_key == 'loan_offer_interactive':
            return self.build_loan_offer_scene_payload(request)

        product_content = self._product_content(request.product_type or 'loan', request.language or 'English')
        
        i18n = {
            'English': {
                'notice': 'Formal Notice', 'account': 'Account', 'outstanding': 'Total Outstanding', 'summary': 'Status Summary',
                'headline': f'{request.customer_name}, notice for your {product_content["formal"]}',
                'body': f'Payment for {product_content["label"]} at {request.client_name} is overdue. Balance: {outstanding_value}.',
                'cta': f'Contact {request.contact_details} now for repayment options.',
                'ui': {'formalNotice': 'Formal Notice', 'accountStatus': 'Account Status', 'financialHighlights': 'Financial Highlights', 'immediateNextStep': 'Next Step', 'resolutionStillPossible': 'Possible Solution', 'customerLabel': 'Customer', 'clientLabel': 'Client', 'productLabel': 'Product', 'outstandingLabel': 'Outstanding', 'finalSummary': 'Summary', 'contactLabel': 'Contact'}
            },
            'Hindi': {
                'notice': 'औपचारिक सूचना', 'account': 'खाता', 'outstanding': 'कुल बकाया', 'summary': 'स्थिति सारांश',
                'headline': f'{request.customer_name} जी, आपके {product_content["formal"]} पर सूचना',
                'body': f'{request.client_name} में {product_content["label"]} का भुगतान लंबित है। बकाया राशि: {outstanding_value}।',
                'cta': f'समाधान के लिए अभी {request.contact_details} पर संपर्क करें।',
                'ui': {'formalNotice': 'औपचारिक सूचना', 'accountStatus': 'खाता स्थिति', 'financialHighlights': 'वित्तीय मुख्य बिंदु', 'immediateNextStep': 'तत्काल अगला कदम', 'resolutionStillPossible': 'समाधान अभी भी संभव है', 'customerLabel': 'ग्राहक', 'clientLabel': 'बैंक', 'productLabel': 'उत्पाद', 'outstandingLabel': 'कुल बकाया', 'finalSummary': 'अंतिम सारांश', 'contactLabel': 'संपर्क'}
            },
            'Marathi': {
                'notice': 'औपचारिक सूचना', 'account': 'खाते', 'outstanding': 'एकूण थकबाकी', 'summary': 'स्थिती सारांश',
                'headline': f'{request.customer_name}, तुमच्या {product_content["formal"]} बाबत सूचना',
                'body': f'{request.client_name} मधील {product_content["label"]} चे पेमेंट थकीत आहे. थकबाकी: {outstanding_value}.',
                'cta': f'निवारणाबाबत अधिक माहितीसाठी आताच {request.contact_details} वर संपर्क साधा.',
                'ui': {'formalNotice': 'औपचारिक सूचना', 'accountStatus': 'खाते स्थिती', 'financialHighlights': 'ठळक मुद्दे', 'immediateNextStep': 'पुढचे पाऊल', 'resolutionStillPossible': 'निवारण शक्य आहे', 'customerLabel': 'ग्राहक', 'clientLabel': 'बँक', 'productLabel': 'उत्पादन', 'outstandingLabel': 'एकूण थकबाकी', 'finalSummary': 'सारांश', 'contactLabel': 'संपर्क'}
            },
            'Tamil': {
                'notice': 'முறைப்படியான அறிவிப்பு', 'account': 'கணக்கு', 'outstanding': 'மொத்த நிலுவை', 'summary': 'நிலை சுருக்கம்',
                'headline': f'{request.customer_name}, உங்கள் {product_content["formal"]} கணக்கிற்கான அறிவிப்பு',
                'body': f'{request.client_name}-இல் உங்கள் {product_content["label"]} நிலுவையில் உள்ளது. நிலுவைத் தொகை: {outstanding_value}.',
                'cta': f'தீர்வு காண இப்போது {request.contact_details}-ஐ அழைக்கவும்.',
                'ui': {'formalNotice': 'முறைப்படியான அறிவிப்பு', 'accountStatus': 'கணக்கு நிலை', 'financialHighlights': 'சிறப்பம்சங்கள்', 'immediateNextStep': 'அடுத்த படி', 'resolutionStillPossible': 'தீர்வு சாத்தியமே', 'customerLabel': 'வாடிக்கையாளர்', 'clientLabel': 'வங்கி', 'productLabel': 'தயாரிப்பு', 'outstandingLabel': 'மொத்த நிலுவை', 'finalSummary': 'சுருக்கம்', 'contactLabel': 'தொடர்பு'}
            },
            'Telugu': {
                'notice': 'అధికారిక నోటీసు', 'account': 'ఖాతా', 'outstanding': 'మొత్తం బకాయి', 'summary': 'స్థితి సారాంశం',
                'headline': f'{request.customer_name}, మీ {product_content["formal"]} పై నోటీసు',
                'body': f'{request.client_name} లో మీ {product_content["label"]} చెల్లింపు పెండింగ్‌లో ఉంది. బకాయి: {outstanding_value}.',
                'cta': f'పరిష్కారం కోసం ఇప్పుడే {request.contact_details} ని సంప్రదించండి.',
                'ui': {'formalNotice': 'అధికారిక నోటీసు', 'accountStatus': 'ఖాతా స్థితి', 'financialHighlights': 'ముఖ్యాంశాలు', 'immediateNextStep': 'తదుపరి దశ', 'resolutionStillPossible': 'పరిష్కారం సాధ్యమే', 'customerLabel': 'కస్టమర్', 'clientLabel': 'బ్యాంక్', 'productLabel': 'ఉత్పత్తి', 'outstandingLabel': 'మొత్తం బకాయి', 'finalSummary': 'సారాంశం', 'contactLabel': 'సంప్రదించండి'}
            },
            'Kannada': {
                'notice': 'ಔಪಚಾರಿಕ ಸೂಚನೆ', 'account': 'ಖಾತೆ', 'outstanding': 'ಒಟ್ಟು ಬಾಕಿ', 'summary': 'ಸ್ಥಿತಿ ಸಾರಾಂಶ',
                'headline': f'{request.customer_name}, ನಿಮ್ಮ {product_content["formal"]} ಬಗ್ಗೆ ಸೂಚನೆ',
                'body': f'{request.client_name} ನಲ್ಲಿ ನಿಮ್ಮ {product_content["label"]} ಪಾವತಿ ಬಾಕಿ ಇದೆ. ಒಟ್ಟು ಬಾಕಿ: {outstanding_value}.',
                'cta': f'ಪರಿಹಾರಕ್ಕಾಗಿ ಈಗಲೇ {request.contact_details} ಗೆ ಕರೆ ಮಾಡಿ.',
                'ui': {'formalNotice': 'ಔಪಚಾರಿಕ ಸೂಚನೆ', 'accountStatus': 'ಖಾತೆ ಸ್ಥಿತಿ', 'financialHighlights': 'ಪ್ರಮುಖಾಂಶಗಳು', 'immediateNextStep': 'ಮುಂದಿನ ಹಂತ', 'resolutionStillPossible': 'ಪರಿಹಾರ ಸಾಧ್ಯವಿದೆ', 'customerLabel': 'ಗ್ರಾಹಕರು', 'clientLabel': 'ಬ್ಯಾಂಕ್', 'productLabel': 'ಉತ್ಪನ್ನ', 'outstandingLabel': 'ಒಟ್ಟು ಬಾಕಿ', 'finalSummary': 'ಸಾರಾಂಶ', 'contactLabel': 'ಸಂಪರ್ಕಿಸಿ'}
            },
            'Bengali': {
                'notice': 'আনুষ্ঠানিক নোটিশ', 'account': 'অ্যাকাউন্ট', 'outstanding': 'মোট বকেয়া', 'summary': 'স্থিতি সারাংশ',
                'headline': f'{request.customer_name}, আপনার {product_content["formal"]}-এর জন্য নোটিশ',
                'body': f'{request.client_name}-এ আপনার {product_content["label"]} পেমেন্ট বকেয়া আছে। মোট বকেয়া: {outstanding_value}।',
                'cta': f'সমাধানের জন্য এখনই {request.contact_details}-এ যোগাযোগ করুন।',
                'ui': {'formalNotice': 'আনুষ্ঠানিক নোটিশ', 'accountStatus': 'অ্যাকাউন্টের স্থিতি', 'financialHighlights': 'হাইলাইট', 'immediateNextStep': 'পরবর্তী পদক্ষেপ', 'resolutionStillPossible': 'সমাধান সম্ভব', 'customerLabel': 'গ্রাহক', 'clientLabel': 'ব্যাংক', 'productLabel': 'পণ্য', 'outstandingLabel': 'মোট বকেয়া', 'finalSummary': 'সারাংশ', 'contactLabel': 'যোগাযোগ'}
            },
            'Gujarati': {
                'notice': 'ઔપચારિક સૂચના', 'account': 'ખાતું', 'outstanding': 'કુલ બાકી રકમ', 'summary': 'સ્થિતિ સારાંશ',
                'headline': f'{request.customer_name}, તમારી {product_content["formal"]} માટે સૂચના',
                'body': f'{request.client_name} માં તમારી {product_content["label"]}ની ચુકવણી બાકી છે. બાકી રકમ: {outstanding_value}.',
                'cta': f'ઉકેલ માટે હમણાં જ {request.contact_details} પર સંપર્ક કરો.',
                'ui': {'formalNotice': 'ઔપચારિક સૂચના', 'accountStatus': 'ખાતાની સ્થિતિ', 'financialHighlights': 'હાઇલાઇટ્સ', 'immediateNextStep': 'આગલું પગલું', 'resolutionStillPossible': 'ઉકેલ શક્ય છે', 'customerLabel': 'ગ્રાહક', 'clientLabel': 'બેંક', 'productLabel': 'ઉત્પાદન', 'outstandingLabel': 'કુલ બાકી રકમ', 'finalSummary': 'સારાંશ', 'contactLabel': 'સંપર્ક'}
            },
            'Malayalam': {
                'notice': 'ഔദ്യോഗിക അറിയിപ്പ്', 'account': 'അക്കൗണ്ട്', 'outstanding': 'ആകെ കുടിശ്ശിക', 'summary': 'നില സംഗ്രഹം',
                'headline': f'{request.customer_name}, നിങ്ങളുടെ {product_content["formal"]} അക്കൗണ്ടിനായുള്ള അറിയിപ്പ്',
                'body': f'{request.client_name}-ൽ നിങ്ങളുടെ {product_content["label"]} തിരിച്ചടവ് കുടിശ്ശികയാണ്. ആകെ തുക: {outstanding_value}.',
                'cta': f'പരിഹാരത്തിനായി ഇപ്പോൾ തന്നെ {request.contact_details}-ൽ ബന്ധപ്പെടുക.',
                'ui': {'formalNotice': 'ഔദ്യോഗിക അറിയിപ്പ്', 'accountStatus': 'അക്കൗണ്ട് നില', 'financialHighlights': 'ഹൈലൈറ്റുകൾ', 'immediateNextStep': 'അടുത്ത നടപടി', 'resolutionStillPossible': 'പരിഹാരം സാധ്യമാണ്', 'customerLabel': 'ഉപഭോക്താവ്', 'clientLabel': 'ബാങ്ക്', 'productLabel': 'ഉൽപ്പന്നം', 'outstandingLabel': 'ആകെ കുടിശ്ശിക', 'finalSummary': 'സംഗ്രഹം', 'contactLabel': 'ബന്ധപ്പെടുക'}
            },
            'Punjabi': {
                'notice': 'ਰਸਮੀ ਨੋਟਿਸ', 'account': 'ਖਾਤਾ', 'outstanding': 'ਕੁੱਲ ਬਕਾਇਆ', 'summary': 'ਸਥਿਤੀ ਸਾਰ',
                'headline': f'{request.customer_name}, ਤੁਹਾਡੇ {product_content["formal"]} ਲਈ ਨੋਟਿਸ',
                'body': f'{request.client_name} ਵਿੱਚ ਤੁਹਾਡੇ {product_content["label"]} ਦੀ ਅਦਾਇਗੀ ਬਾਕੀ ਹੈ। ਕੁੱਲ ਬਕਾਇਆ: {outstanding_value}।',
                'cta': f'ਹੱਲ ਲਈ ਹੁਣੇ {request.contact_details} ਤੇ ਸੰਪਰਕ ਕਰੋ।',
                'ui': {'formalNotice': 'ਰਸਮੀ ਨੋਟਿਸ', 'accountStatus': 'ਖਾਤਾ ਸਥਿਤੀ', 'financialHighlights': 'ਮੁੱਖ ਨੁਕਤੇ', 'immediateNextStep': 'ਅਗਲਾ ਕਦਮ', 'resolutionStillPossible': 'ਹੱਲ ਸੰਭਵ ਹੈ', 'customerLabel': 'ਗਾਹਕ', 'clientLabel': 'ਬੈਂਕ', 'productLabel': 'ਉਤਪਾਦ', 'outstandingLabel': 'ਕੁੱਲ ਬਕਾਇਆ', 'finalSummary': 'ਸਾਰ', 'contactLabel': 'ਸੰਪਰਕ'}
            }
        }

        t = i18n.get(request.language or 'English', i18n['English'])
        
        return {
            'opening': {'eyebrow': t['notice'], 'headline': t['headline'], 'subheadline': f'{request.client_name} | {t["account"]} {request.lan}'},
            'account': {'eyebrow': product_content['summary'], 'headline': f'{t["account"]} {request.lan}', 'supporting': f'{t["outstanding"]} {outstanding_value}', 'badge': 'Formal Notice'},
            'context': {'eyebrow': t['summary'], 'headline': 'Account Overdue', 'body': t['body']},
            'amounts': {'eyebrow': 'Financials', 'headline': 'Amount Summary', 'body': f"Principal: {loan_value}" if loan_value else 'Payment delay', 'note': 'Discuss options.'},
            'action': {'eyebrow': 'Next Step', 'headline': 'Contact Today', 'body': t['cta'], 'cta_label': 'Call Now', 'cta_value': request.contact_details},
            'closing': {'eyebrow': 'Resolution', 'headline': 'Act Now', 'body': f'{request.client_name} is waiting.'},
            'headline_text': t['headline'],
            'cta_text': t['cta'],
            'ui_copy': t.get('ui', i18n['English']['ui'])
        }

    def build_payment_guidance_scene_payload(self, request: RemotionVideoRequest, outstanding_value: str, loan_value: str) -> dict[str, Any]:
        customer = request.customer_name or "Customer"
        client = request.client_name or "Finance Partner"
        lan = request.lan or "N/A"
        contact = request.contact_details or "1800-555-999"
        payable = outstanding_value or loan_value or request.loan_amount or "0"
        payment_i18n = {
            'English': {
                'headline': f"{customer}, here is how to complete your payment",
                'body': f"Open your payment link or PhonePe app, choose Loan Payment, select TVS Credit, verify account {lan}, enter {payable}, and complete the payment.",
                'contact_body': f"For any other help, contact {contact}.",
                'ui': {'formalNotice': 'Payment Guidance', 'accountStatus': 'Account Details', 'financialHighlights': 'Payment Amount', 'immediateNextStep': 'PhonePe Walkthrough', 'resolutionStillPossible': 'Support Available', 'customerLabel': 'Customer', 'clientLabel': 'Company', 'productLabel': 'Product', 'outstandingLabel': 'Payable', 'finalSummary': 'Summary', 'contactLabel': 'Contact'},
                'context_eyebrow': 'Payment link guidance', 'context_headline': 'Follow these simple steps', 'amount_headline': 'Amount to enter', 'amount_note': 'Check details before confirming the payment.', 'action_headline': 'Open PhonePe and pay', 'cta_label': 'Help number', 'closing_headline': 'Payment support is available',
            },
            'Hindi': {
                'headline': f"{customer} जी, भुगतान करने की आसान प्रक्रिया",
                'body': f"अपने भुगतान लिंक या PhonePe ऐप से Loan Payment खोलें, TVS Credit चुनें, खाता संख्या {lan} और राशि {payable} जांचकर भुगतान करें।",
                'contact_body': f"किसी भी सहायता के लिए {contact} पर संपर्क करें।",
                'ui': {'formalNotice': 'भुगतान मार्गदर्शन', 'accountStatus': 'खाता विवरण', 'financialHighlights': 'भुगतान राशि', 'immediateNextStep': 'PhonePe प्रक्रिया', 'resolutionStillPossible': 'सहायता उपलब्ध है', 'customerLabel': 'ग्राहक', 'clientLabel': 'कंपनी', 'productLabel': 'उत्पाद', 'outstandingLabel': 'देय राशि', 'finalSummary': 'सारांश', 'contactLabel': 'संपर्क'},
                'context_eyebrow': 'पेमेंट लिंक मार्गदर्शन', 'context_headline': 'इन आसान चरणों का पालन करें', 'amount_headline': 'दर्ज करने की राशि', 'amount_note': 'भुगतान पुष्टि से पहले विवरण जांचें।', 'action_headline': 'PhonePe खोलें और भुगतान करें', 'cta_label': 'सहायता नंबर', 'closing_headline': 'भुगतान सहायता उपलब्ध है',
            },
        }
        t = payment_i18n.get(request.language or 'English', payment_i18n['English'])
        headline = t['headline']
        body = t['body']
        contact_body = t['contact_body']
        ui = t['ui']

        return {
            'opening': {'eyebrow': ui['formalNotice'], 'headline': headline, 'subheadline': f'{client} | Account {lan}'},
            'account': {'eyebrow': 'Welcome', 'headline': f'Account {lan}', 'supporting': f'Payable amount {payable}', 'badge': 'Personalized guidance'},
            'context': {'eyebrow': t['context_eyebrow'], 'headline': t['context_headline'], 'body': body},
            'amounts': {'eyebrow': ui['financialHighlights'], 'headline': t['amount_headline'], 'body': f'Loan amount: {loan_value or payable}', 'note': t['amount_note']},
            'action': {'eyebrow': ui['immediateNextStep'], 'headline': t['action_headline'], 'body': body, 'cta_label': t['cta_label'], 'cta_value': contact},
            'closing': {'eyebrow': ui['resolutionStillPossible'], 'headline': t['closing_headline'], 'body': contact_body},
            'headline_text': headline,
            'cta_text': contact_body,
            'ui_copy': ui,
        }

    def build_overdue_scene_payload(self, request: RemotionVideoRequest, outstanding_value: str, loan_value: str) -> dict[str, Any]:
        customer = request.customer_name or "Customer"
        client = request.client_name or "HDFC Bank"
        lan = request.lan or "N/A"
        contact = request.contact_details or "1800-555-999"
        payable = outstanding_value or request.tos or "0"
        min_due = loan_value or request.loan_amount or "0"
        
        overdue_i18n = {
            'English': {
                'headline': f"Dear {customer}",
                'body': f"Your {client} credit card ending with {lan} has an overdue amount of {payable}. Timely repayment protects your credit score, ensures access to future loans, and avoids late fees or penalties.",
                'contact_body': f"For any help, contact {contact}.",
                'ui': {'formalNotice': 'Overdue Notice', 'accountStatus': 'Account details', 'financialHighlights': 'Due Summary', 'immediateNextStep': 'Contact Information', 'resolutionStillPossible': 'Repayment Options', 'customerLabel': 'Customer', 'clientLabel': 'Bank', 'productLabel': 'Product', 'outstandingLabel': 'Overdue', 'finalSummary': 'Summary', 'contactLabel': 'Contact'},
            },
            'Hindi': {
                'headline': f"प्रिय {customer}",
                'body': f"आपके {client} क्रेडिट कार्ड जिसके अंत में {lan} है, का बकाया भुगतान {payable} है। समय पर भुगतान आपके क्रेडिट स्कोर को सुरक्षित रखता है और भविष्य के लोन सुनिश्चित करता है।",
                'contact_body': f"किसी भी सहायता के लिए {contact} पर संपर्क करें।",
                'ui': {'formalNotice': 'बकाया नोटिस', 'accountStatus': 'खाता विवरण', 'financialHighlights': 'देय विवरण', 'immediateNextStep': 'संपर्क जानकारी', 'resolutionStillPossible': 'भुगतान विकल्प', 'customerLabel': 'ग्राहक', 'clientLabel': 'बैंक', 'productLabel': 'उत्पाद', 'outstandingLabel': 'बकाया राशि', 'finalSummary': 'सारांश', 'contactLabel': 'संपर्क'},
            }
        }
        t = overdue_i18n.get(request.language or 'English', overdue_i18n['English'])
        
        return {
            'opening': {'eyebrow': t['ui']['formalNotice'], 'headline': t['headline'], 'subheadline': f'{client} | Card {lan}'},
            'account': {'eyebrow': 'Welcome', 'headline': f'Card {lan}', 'supporting': f'Overdue {payable}', 'badge': 'Overdue'},
            'context': {'eyebrow': 'Account status', 'headline': 'NPA Alert', 'body': t['body']},
            'amounts': {'eyebrow': 'Amounts', 'headline': 'Payable Summary', 'body': f'Min Due: {min_due} | Total Due: {payable}', 'note': 'Act now to avoid NPA.'},
            'action': {'eyebrow': 'Timely repayment benefits', 'headline': 'Repayment Benefits', 'body': t['body'], 'cta_label': 'Call', 'cta_value': contact},
            'closing': {'eyebrow': 'Outro', 'headline': 'Thank you', 'body': t['contact_body']},
            'headline_text': t['headline'],
            'cta_text': t['contact_body'],
            'ui_copy': t['ui'],
        }

    def build_loan_offer_scene_payload(self, request: RemotionVideoRequest) -> dict[str, Any]:
        customer = request.customer_name or "Customer"
        client = request.client_name or "TVS Credit"
        max_amount = request.max_loan_amount or request.loan_amount or "105000"
        max_tenure = request.max_tenure or "60"
        max_emi = request.max_emi or request.tos or "3398"
        contact = request.cta_phone_number or request.contact_details or "1800-555-999"

        return {
            'opening': {
                'eyebrow': 'Pre-approved offer',
                'headline': f'Congratulations {customer}',
                'subheadline': f'{client} loan offer up to {max_amount}',
            },
            'account': {
                'eyebrow': 'Offer details',
                'headline': f'Max loan amount {max_amount}',
                'supporting': f'Max tenure {max_tenure} months | EMI {max_emi}',
                'badge': 'Interactive selection',
            },
            'action': {
                'eyebrow': 'Confirm your offer',
                'headline': 'Choose loan amount and tenure',
                'body': f'Customer can select amount, tenure, and confirm the offer. Call CTA: {contact}',
                'cta_label': 'Call now',
                'cta_value': contact,
            },
            'headline_text': f'Congratulations {customer}, your loan offer is ready',
            'cta_text': f'Choose your preferred loan amount and tenure. For help, call {contact}.',
        }

    def build_render_payload(self, request: RemotionVideoRequest, video_id: str, script_text: str, audio_path: str, vtt_path: Path, scene_payload: dict[str, Any]) -> dict[str, Any]:
        subtitles = self.parse_vtt(vtt_path)
        is_universal = (request.video_variety or "personalized") == "universal"
        return {
            "id": video_id,
            "language": request.language,
            "video_variety": request.video_variety or "personalized",
            "template_key": request.template_key or "account_notice",
            "video_width": 1080 if request.template_key in ("payment_link_guidance", "overdue_template", "loan_offer_interactive", "scene_loan_offer", "tvs_credit_emi") else None,
            "video_height": 1920 if request.template_key in ("payment_link_guidance", "overdue_template", "loan_offer_interactive", "scene_loan_offer", "tvs_credit_emi") else None,
            "audio_url": audio_path,
            "subtitles": subtitles,
            "customer_name": "" if is_universal else request.customer_name,
            "lan": "" if is_universal else request.lan,
            "client_name": "" if is_universal else request.client_name,
            "tos": "" if is_universal else (request.tos or ""),
            "loan_amount": "" if is_universal else (request.loan_amount or ""),
            "contact_details": "" if is_universal else (request.contact_details or ""),
            "product_type": "" if is_universal else (request.product_type or "loan"),
            "loan_offer": {
                "max_loan_amount": request.max_loan_amount or request.loan_amount or "105000",
                "max_tenure": request.max_tenure or "60",
                "max_emi": request.max_emi or request.tos or "3398",
                "loan_id": request.loan_id or request.lan or "124356",
                "cta_phone_number": request.cta_phone_number or request.contact_details or "1800-555-999",
                "month_24_loan_amount": request.month_24_loan_amount or "75000",
                "month_30_loan_amount": request.month_30_loan_amount or "90000",
                "month_36_loan_amount": request.month_36_loan_amount or "105000",
                "month_42_loan_amount": request.month_42_loan_amount or "NA",
                "month_48_loan_amount": request.month_48_loan_amount or "NA",
                "month_60_loan_amount": request.month_60_loan_amount or request.max_loan_amount or request.loan_amount or "105000",
                "emi_calculation24": request.emi_calculation24 or "",
                "emi_calculation30": request.emi_calculation30 or "",
                "emi_calculation36": request.emi_calculation36 or "",
                "emi_calculation42": request.emi_calculation42 or "",
                "emi_calculation48": request.emi_calculation48 or "",
                "emi_calculation60": request.emi_calculation60 or request.max_emi or request.tos or "3398",
            },
            "scene_payload": scene_payload,
            "branding": {
                "logo": {
                    "public_path": f"assets/{request.logo_filename}" if request.logo_filename else None,
                    "position": request.logo_position or "Top Right",
                    "opacity": request.logo_opacity if request.logo_opacity is not None else 80
                },
                "subtitles": {
                    "enabled": request.include_captions,
                    "color": request.subtitle_color or "White",
                    "position": request.subtitle_position or "Bottom"
                },
                "primary_color": request.primary_color or "#003366",
                "secondary_color": request.secondary_color or "#FF9900"
            },
            "interactiveBackgroundColor": request.interactive_background_color,
            "interactiveCtaColor": request.interactive_cta_color
        }

    def _time_to_seconds(self, value: str) -> float:
        normalized = value.replace(',', '.')
        p = normalized.split(':')
        return int(p[0]) * 3600 + int(p[1]) * 60 + float(p[2]) if len(p) == 3 else 0.0

    def parse_vtt(self, vtt_path: Path) -> list[dict[str, Any]]:
        if not vtt_path.exists(): return []
        content = vtt_path.read_text(encoding='utf-8')
        subs = []
        for start, end, text in self.vtt_pattern.findall(content):
            subs.append({'text': ' '.join(text.split()), 'start': self._time_to_seconds(start), 'end': self._time_to_seconds(end)})
        return subs

    def compute_emi_step_boundaries(
        self,
        subtitles: list[dict[str, Any]],
        audio_duration: float,
        fps: int = 30,
        language: str = "English",
    ) -> list[int]:
        """
        Compute per-scene frame start boundaries for the EMI template by searching VTT
        subtitle text for scene-anchor keywords.  Returns a list of 11 frame numbers
        (one per scene transition: scene-0 always starts at frame 0, so we return
        boundaries[0..10] = start-frames of scenes 1..11).

        The 12 EMI scenes in order are:
          0  intro            – customer greeting + account statement
          1  method1-text     – "Method 1" announcement
          2  whatsapp-image   – WhatsApp Pay-Now screenshot
          3  sms-image        – SMS link screenshot
          4  method2-text     – "Method 2" announcement
          5  upi-image        – open PhonePe / Google Pay
          6  openapp-image    – search / repayment step
          7  enterlan-image   – enter LAN + UPI PIN
          8  success-image    – payment success confirmation
          9  method3-text     – "Method 3" announcement
         10  shop-image       – visit EMI collection shop
         11  final            – contact details / closing
        """
        is_hindi = language.lower() in ("hindi", "hi")

        # Anchor phrases per scene index (0-indexed). We search for the FIRST subtitle
        # whose normalised text contains any of these fragments (case-insensitive).
        # Pairs are: (scene_index, [anchor_phrases])
        # Scenes 0 starts at frame 0 by definition, so we only need anchors for 1..11.
        ANCHORS_EN = [
            (1,  ["method 1", "payment link", "method one"]),
            (2,  ["whatsapp", "pay now button", "secure link"]),
            (3,  ["sms", "via sms", "link shared"]),
            (4,  ["method 2", "method two", "upi", "payment app"]),
            (5,  ["phonepe", "google pay", "open phonepe"]),
            (6,  ["repayment", "go to repayment", "search for"]),
            (7,  ["enter lan", "lan and complete", "upi pin"]),
            (8,  ["successful payment", "payment confirmation", "wait for"]),
            (9,  ["method 3", "method three", "emi collection", "collection shop"]),
            (10, ["visit", "nearest emi", "deposit your emi", "shop"]),
            (11, ["contact", "contact details", "immediately", "avoid charges"]),
        ]
        ANCHORS_HI = [
            (1,  ["method 1", "पेमेंट लिंक", "भुगतान लिंक"]),
            (2,  ["व्हाट्सएप", "whatsapp", "सुरक्षित लिंक"]),
            (3,  ["sms", "एसएमएस"]),
            (4,  ["method 2", "upi", "phonepe", "google pay", "पेमेंट ऐप"]),
            (5,  ["phonepe", "google pay", "ऐप खोलें"]),
            (6,  ["repayment", "पुनर्भुगतान", "खोजें"]),
            (7,  ["अपना lan दर्ज", "lan दर्ज", "लैन दर्ज", "दर्ज करें"]),
            (8,  ["upi पिन का उपयोग", "upi pin", "भुगतान पूरा", "सफल भुगतान", "पुष्टि", "confirmation"]),
            (9,  ["method 3", "emi collection", "कलेक्शन शॉप"]),
            (10, ["नजदीकी", "शॉप", "जमा करने"]),
            (11, ["संपर्क", "contact", "अतिरिक्त शुल्क"]),
        ]
        anchors = ANCHORS_HI if is_hindi else ANCHORS_EN

        def find_scene_start_time(anchor_phrases: list[str], search_after_sec: float = 0.0) -> float | None:
            """Return the estimated start time of the first subtitle matching any anchor."""
            for sub in subtitles:
                if sub['end'] < search_after_sec:
                    continue
                sub_lower = sub['text'].lower()
                for phrase in anchor_phrases:
                    phrase_lower = phrase.lower()
                    phrase_index = sub_lower.find(phrase_lower)
                    if phrase_index == -1:
                        continue
                    subtitle_duration = max(0.0, float(sub['end']) - float(sub['start']))
                    text_duration_offset = 0.0
                    if subtitle_duration > 0 and len(sub_lower) > 0:
                        text_duration_offset = (phrase_index / len(sub_lower)) * subtitle_duration
                    estimated_start = float(sub['start']) + text_duration_offset
                    if estimated_start >= search_after_sec:
                        return estimated_start
            return None

        # Build scene-start times in seconds; default to proportional fallback
        # Fallback relative durations (en / hi) mirrored from scenes.ts
        FALLBACK_RATIOS = {
            'en': [0.286, 0.043, 0.055, 0.059, 0.055, 0.070, 0.070, 0.047, 0.051, 0.058, 0.058, 0.149],
            'hi': [0.265, 0.050, 0.056, 0.075, 0.057, 0.086, 0.087, 0.052, 0.046, 0.055, 0.056, 0.115],
        }
        lang_key = 'hi' if is_hindi else 'en'
        ratios = FALLBACK_RATIOS[lang_key]
        cumulative = 0.0
        fallback_times = []
        for r in ratios:
            fallback_times.append(cumulative * audio_duration)
            cumulative += r

        # Resolve VTT anchors; fall back to ratio-derived time when not found.
        # We search forward from the previous scene's detected start so that the
        # same keyword appearing in multiple scenes is matched in the right order.
        scene_start_times: list[float] = [0.0]  # scene 0 always at t=0
        for scene_idx, phrases in anchors:
            # Search strictly after the previous scene started
            search_from = scene_start_times[-1]
            vtt_time = find_scene_start_time(phrases, search_after_sec=search_from)
            if vtt_time is None:
                vtt_time = fallback_times[scene_idx]
            # Enforce monotonic ordering with a small minimum gap
            if vtt_time <= scene_start_times[-1]:
                vtt_time = scene_start_times[-1] + 0.3
            scene_start_times.append(vtt_time)

        # Convert to frame numbers (skip index 0 since scene 0 = frame 0)
        boundaries = [max(1, round(t * fps)) for t in scene_start_times[1:]]
        logger.info(f"EMI step boundaries (frames @ {fps}fps): {boundaries}")
        return boundaries

    async def render_video(self, request: RemotionVideoRequest, video_id: str, scene_payload: dict[str, Any], render_payload: dict[str, Any]) -> str:
        logger.info("Render video started")
        _ensure_remotion_runtime_files(self.remotion_path)
        leads_path = self.remotion_path / "leads.json"
        is_root_props_template = request.template_key in {"loan_reminder", "collection_reminder", "tvs_credit_emi"}
        is_loan_reminder = request.template_key == "loan_reminder"
        is_scene_loan_offer = request.template_key == "scene_loan_offer"
        if not is_root_props_template and not is_scene_loan_offer:
            leads = [render_payload] # Keep it simple for now
            leads_path.write_text(json.dumps(leads, ensure_ascii=False, indent=2), encoding='utf-8')
        
        output_name = f"{video_id}.mp4"
        output_path = settings.output_dir / output_name
        output_path.parent.mkdir(exist_ok=True)
        
        props_path = self.remotion_path / f"props_{video_id}.json"
        props_path.write_text(
            json.dumps(render_payload if (is_root_props_template or is_scene_loan_offer) else {"leadId": video_id}, ensure_ascii=False),
            encoding='utf-8',
        )
        logger.info("Render video started command")
        
        def run_render():
            backend = (settings.remotion_render_backend or "cli").strip().lower()
            if backend == "service":
                # Persistent renderer service: reuse bundle + Chromium across jobs.
                from app.services.remotion_renderer_client import RendererClient

                entry_point, composition_id = service_entry_composition(request.template_key)
                # Root-props/scene templates already carry full props; the `main`
                # (TemplateVideo) path is leads.json-driven under the CLI, so pass
                # the lead explicitly to keep the persistent bundle stateless.
                if is_root_props_template or is_scene_loan_offer:
                    service_props = render_payload
                else:
                    service_props = {"leadId": video_id, "lead": render_payload}
                RendererClient().render(
                    entry_point=entry_point,
                    composition_id=composition_id,
                    input_props=service_props,
                    output_location=str(output_path),
                    job_id=video_id,
                    request_mode=request.template_key or "remotion",
                )
                return None

            import subprocess
            import uuid

            npx = "npx.cmd" if os.name == 'nt' else "npx"
            if request.template_key == "loan_reminder":
                c = f'{npx} remotion render src/Root.tsx LoanReminderVideo "{output_path}" --props="{str(props_path).replace(os.sep, "/")}" --overwrite'
            elif request.template_key == "collection_reminder":
                c = f'{npx} remotion render src/Root.tsx CollectionReminderVideo "{output_path}" --props="{str(props_path).replace(os.sep, "/")}" --overwrite'
            elif request.template_key == "tvs_credit_emi":
                c = f'{npx} remotion render src/index.jsx TVSCreditEMITemplate "{output_path}" --props="{str(props_path).replace(os.sep, "/")}" --overwrite'
            elif is_scene_loan_offer:
                c = f'{npx} remotion render src/index.jsx SceneLoanOfferVideo "{output_path}" --props="{str(props_path).replace(os.sep, "/")}" --overwrite'
            else:
                c = f'{npx} remotion render src/index.jsx main "{output_path}" --props="{str(props_path).replace(os.sep, "/")}" --overwrite'
            browser_exe = settings.remotion_browser_executable or os.environ.get("REMOTION_BROWSER_EXECUTABLE")
            if browser_exe:
                c += f' --browser-executable="{browser_exe}"'
            
            # Pure file handle without tempfile locking mechanics
            out_file = self.remotion_path / f"out_{uuid.uuid4().hex}.log"
            
            with open(out_file, "w", encoding="utf-8") as out_f:
                try:
                    result = subprocess.run(
                        c, 
                        cwd=str(self.remotion_path), 
                        shell=True, 
                        stdout=out_f, 
                        stderr=subprocess.STDOUT,
                        stdin=subprocess.DEVNULL,
                        timeout=settings.remotion_render_timeout_seconds,
                    )
                except subprocess.TimeoutExpired as exc:
                    out_f.flush()
                    stdout_text = out_file.read_text(encoding="utf-8", errors="ignore") if out_file.exists() else ""
                    logger.error(
                        "Remotion timed out after "
                        f"{settings.remotion_render_timeout_seconds}s. Output: {_tail(stdout_text)!r}"
                    )
                    raise ValueError(
                        "Remotion process permanently froze and timed out after "
                        f"{settings.remotion_render_timeout_seconds}s. output={_tail(stdout_text)!r}"
                    ) from exc
            # Read after process safely completes
            if out_file.exists():
                stdout_text = out_file.read_text(encoding="utf-8", errors="ignore")
                try: out_file.unlink() # Cleanup silently
                except: pass
            else:
                stdout_text = ""
                
            if result.returncode != 0:
                logger.error(f"Remotion render failed with code {result.returncode}")
                logger.error(f"Remotion output: {stdout_text}")
                raise ValueError(f"Remotion render failed: {stdout_text}")
            return result

        try:
            result_process = await asyncio.to_thread(run_render)
        except Exception as e:
            logger.error(f"Failed to start Remotion rendering: {e}")
            raise e
        finally:
            # PRODUCTION FIX: Always cleanup the props and temporary files
            if props_path.exists():
                try:
                    props_path.unlink()
                    logger.info(f"Cleaned up Remotion props file: {props_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup props file: {e}")

        # Final check if output actually exists
        if not output_path.exists():
            raise ValueError("Remotion render exited completely but output video was NOT created on disk.")

        return f"/{output_name}"

    async def generate_video(self, request: RemotionVideoRequest, video_id: str | None = None) -> dict[str, Any]:
        # Save logo asset if present
        if request.logo_bytes and request.logo_filename:
            await self._persist_logo_asset(request.logo_bytes, request.logo_filename)

        is_universal = (request.video_variety or "personalized") == "universal"

        tts = await self.generate_tts(request, video_id=video_id)
        if request.template_key == "scene_loan_offer":
            audio_duration = float(tts.get("duration") or 30)
            subtitles = self.parse_vtt(tts["vtt_path"])
            sales_assets = await self._persist_sales_template_assets(request, tts["video_id"])
            render_p = {
                "voiceoverAudioSrc": tts["audio_path"].lstrip("/") if tts.get("audio_path") else None,
                "audioPlaybackRate": 1,
                "durationInFrames": max(900, int(audio_duration * 30) + 15),
                "subtitles": subtitles,
                "customer_name": "" if is_universal else request.customer_name,
                "loan_amount": "" if is_universal else (request.max_loan_amount or request.loan_amount),
                "salesImagePaths": sales_assets,
                "scene1": sales_assets.get("scene1"),
                "scene2": sales_assets.get("scene2"),
                "scene3": sales_assets.get("scene3"),
                "scene4": sales_assets.get("scene4"),
                "scene5": sales_assets.get("scene5"),
            }
            video_url = await self.render_video(request, tts["video_id"], {}, render_p)
            return {
                "video_url": video_url,
                "video_path": settings.output_dir / video_url.lstrip('/'),
                "audio_path": self.remotion_path / "public" / tts['audio_path'].lstrip('/'),
                "audio_url": tts['audio_path'],
                "video_id": tts['video_id'],
                "text": tts['text'],
            }

        if request.template_key == "tvs_credit_emi":
            audio_duration = float(tts.get("duration") or 30)
            emi_assets = await self._persist_emi_template_assets(request, tts["video_id"])
            # Parse subtitles from VTT to compute exact per-scene frame boundaries
            subtitles = self.parse_vtt(tts["vtt_path"])
            fps = 30
            step_boundaries = self.compute_emi_step_boundaries(
                subtitles=subtitles,
                audio_duration=audio_duration,
                fps=fps,
                language=request.language or "English",
            )
            render_p = {
                "enableNarration": True,
                "narrationAudioPath": tts["audio_path"].lstrip("/") if tts.get("audio_path") else None,
                "customerName": request.customer_name or "Customer",
                "productType": request.product_type or "Two Wheeler Loan",
                "clientName": request.client_name or "TVS Credit",
                "tos": str(request.tos or "0"),
                "lan": request.lan or "1234",
                "contactDetails": request.contact_details or "1800-123-4567",
                "durationInFrames": max(900, int(audio_duration * fps) + 15),
                "language": request.language,
                "logoUrl": f"assets/{request.logo_filename}" if request.logo_filename else None,
                "logoPosition": request.logo_position or "Top Right",
                "logoOpacity": request.logo_opacity if request.logo_opacity is not None else 80,
                "stepBoundaries": step_boundaries,
                "emiImagePaths": emi_assets,
                "whatsappPaynow": emi_assets.get("whatsappPaynow"),
                "smsLink": emi_assets.get("smsLink"),
                "upiApps": emi_assets.get("upiApps"),
                "openappSearch": emi_assets.get("openappSearch"),
                "enterlan": emi_assets.get("enterlan"),
                "paymentSuccess": emi_assets.get("paymentSuccess"),
                "shopVisit": emi_assets.get("shopVisit"),
            }
            video_url = await self.render_video(request, tts["video_id"], {}, render_p)
            return {
                "video_url": video_url,
                "video_path": settings.output_dir / video_url.lstrip('/'),
                "audio_path": self.remotion_path / "public" / tts['audio_path'].lstrip('/'),
                "audio_url": tts['audio_path'],
                "video_id": tts['video_id'],
                "text": tts['text']
            }

        if request.template_key == "loan_reminder":
            loan_assets = await self._persist_loan_reminder_assets(request, tts["video_id"])
            render_p = self.build_loan_reminder_props(request, tts["audio_path"], loan_assets)
            video_url = await self.render_video(request, tts["video_id"], {}, render_p)
            return {
                "video_url": video_url,
                "video_path": settings.output_dir / video_url.lstrip('/'),
                "audio_path": self.remotion_path / "public" / tts['audio_path'].lstrip('/'),
                "audio_url": tts['audio_path'],
                "video_id": tts['video_id'],
                "text": tts['text']
            }

        if request.template_key == "collection_reminder":
            render_p = self.build_collection_reminder_props(request, tts["audio_path"])
            video_url = await self.render_video(request, tts["video_id"], {}, render_p)
            return {
                "video_url": video_url,
                "video_path": settings.output_dir / video_url.lstrip('/'),
                "audio_path": self.remotion_path / "public" / tts['audio_path'].lstrip('/'),
                "audio_url": tts['audio_path'],
                "video_id": tts['video_id'],
                "text": tts['text']
            }

        # Universal mode: use generic scene cards so no empty customer data leaks
        # into the Remotion visual scenes.
        if is_universal:
            scene = self.build_universal_scene_payload(request)
        else:
            scene = self.build_scene_payload(request, str(request.tos or "0"), str(request.loan_amount or ""), "elevated")
        render_p = self.build_render_payload(request, tts['video_id'], tts['text'], tts['audio_path'], tts['vtt_path'], scene)
        video_url = await self.render_video(request, tts['video_id'], scene, render_p)
        return {
            "video_url": video_url,
            "video_path": settings.output_dir / video_url.lstrip('/'),
            "audio_path": self.remotion_path / "public" / tts['audio_path'].lstrip('/'),
            "audio_url": tts['audio_path'],
            "video_id": tts['video_id'], 
            "text": tts['text'],
            "subtitles": render_p.get("subtitles")
        }

    async def _persist_logo_asset(self, file_content: bytes, filename: str) -> str:
        (self.assets_path / filename).write_bytes(file_content)
        return filename
