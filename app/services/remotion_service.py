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
from mutagen.mp3 import MP3

from app.config import settings
from app.models import RemotionVideoRequest
from datetime import datetime
from app.utils.text_utils import normalize_hindi_numbers

logger = logging.getLogger(__name__)

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


def _prepare_tts_pronunciation(text: str) -> str:
    # Keep the brand spelling in scripts/subtitles, but guide TTS to say "PhonePay".
    return re.sub(r'\bPhonePe\b', 'PhonePay', text, flags=re.IGNORECASE)


def _restore_display_spellings(text: str) -> str:
    return re.sub(r'\bPhonePay\b', 'PhonePe', text, flags=re.IGNORECASE)

class RemotionService:
    def __init__(self):
        self.remotion_path = settings.remotion_path
        self.public_path = self.remotion_path / "public"
        self.assets_path = self.public_path / "assets"
        self.assets_path.mkdir(parents=True, exist_ok=True)
        # Support both . and , as millisecond separators since edge-tts uses commas (SRT style)
        self.vtt_pattern = re.compile(r'(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*(.+?)(?=\n\d{2}:\d{2}|$)', re.DOTALL)
        


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
        
        voice_key = f"{request.language}-{request.voice_gender.capitalize()}"
        voice = VOICE_MAP.get(voice_key, VOICE_MAP.get("Hindi-Female"))
        
        is_universal = (request.video_variety or "personalized") == "universal"

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

        tts_text = _prepare_tts_pronunciation(script_text)
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
                result = subprocess.run(command, shell=True, stdout=out_f, stderr=err_f)
                out_f.seek(0)
                err_f.seek(0)
                stdout_text = out_f.read().decode('utf-8', errors='ignore')
                stderr_text = err_f.read().decode('utf-8', errors='ignore')
                if result.returncode != 0:
                    logger.error(f"TTS Process Error: {stderr_text}")
                    raise Exception(f"TTS Error: {stderr_text}")
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
                vtt_file.write_text(_restore_display_spellings(vtt_file.read_text(encoding='utf-8')), encoding='utf-8')

        finally:
            if os.path.exists(temp_text_file):
                try:
                    os.remove(temp_text_file)
                except Exception:
                    pass
            
        audio_meta = MP3(audio_file)
        return {
            "video_id": video_id,
            "audio_path": f"/audio/{video_id}.mp3",
            "full_audio_path": str(audio_file),
            "vtt_path": vtt_file,
            "duration": audio_meta.info.length,
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
            'action': {'eyebrow': s['action_eyebrow'], 'headline': s['action_headline'], 'body': s['action_body'] + (f' {contact}' if contact else ''), 'cta_label': s['action_cta_label'], 'cta_value': contact},
            'closing': {'eyebrow': s['closing_eyebrow'], 'headline': s['closing_headline'], 'body': s['closing_body']},
            'headline_text': s['headline'],
            'cta_text': s['action_body'],
            'ui_copy': s.get('ui', t['English']['ui'])
        }

    def build_scene_payload(self, request: RemotionVideoRequest, outstanding_value: str, loan_value: str, urgency_level: str) -> dict[str, Any]:
        if request.template_key == 'payment_guidance':
            return self.build_payment_guidance_scene_payload(request, outstanding_value, loan_value)

        product_content = self._product_content(request.product_type, request.language)
        
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

        t = i18n.get(request.language, i18n['English'])
        
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
        client = request.client_name or "TVS Credit"
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
        t = payment_i18n.get(request.language, payment_i18n['English'])
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

    def build_render_payload(self, request: RemotionVideoRequest, video_id: str, script_text: str, audio_path: str, vtt_path: Path, scene_payload: dict[str, Any]) -> dict[str, Any]:
        subtitles = self.parse_vtt(vtt_path)
        is_universal = (request.video_variety or "personalized") == "universal"
        return {
            "id": video_id,
            "language": request.language,
            "video_variety": request.video_variety or "personalized",
            "template_key": request.template_key or "account_notice",
            "video_width": 1080 if request.template_key == "payment_link_guidance" else None,
            "video_height": 1920 if request.template_key == "payment_link_guidance" else None,
            "audio_url": audio_path,
            "subtitles": subtitles,
            "customer_name": "" if is_universal else request.customer_name,
            "lan": "" if is_universal else request.lan,
            "client_name": "" if is_universal else request.client_name,
            "tos": "" if is_universal else (request.tos or ""),
            "loan_amount": "" if is_universal else (request.loan_amount or ""),
            "contact_details": "" if is_universal else (request.contact_details or ""),
            "product_type": "" if is_universal else (request.product_type or "loan"),
            "scene_payload": scene_payload,
            "branding": {
                "logo": {
                    "public_path": f"assets/{request.logo_filename}" if request.logo_filename else None,
                    "position": "Top Right",
                    "opacity": 80
                },
                "primary_color": request.primary_color or "#003366",
                "secondary_color": request.secondary_color or "#FF9900"
            }
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

    async def render_video(self, request: RemotionVideoRequest, video_id: str, scene_payload: dict[str, Any], render_payload: dict[str, Any]) -> str:
        logger.info("Render video started")
        leads_path = self.remotion_path / "leads.json"
        leads = [render_payload] # Keep it simple for now
        leads_path.write_text(json.dumps(leads, ensure_ascii=False, indent=2), encoding='utf-8')
        
        output_name = f"{video_id}.mp4"
        output_path = settings.output_dir / output_name
        output_path.parent.mkdir(exist_ok=True)
        
        props_path = self.remotion_path / f"props_{video_id}.json"
        props_path.write_text(json.dumps({"leadId": video_id}, ensure_ascii=False), encoding='utf-8')
        logger.info("Render video started command")
        
        def run_render():
            import subprocess
            import uuid
            
            npx = "npx.cmd" if os.name == 'nt' else "npx"
            c = f'{npx} --yes remotion render src/index.jsx main "{output_path}" --props="{str(props_path).replace(os.sep, "/")}" --overwrite'
            if settings.remotion_browser_executable:
                c += f' --browser-executable="{settings.remotion_browser_executable}"'
            
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
                        timeout=600 # 10 minute absolute limit to prevent queue deadlock
                    )
                except subprocess.TimeoutExpired:
                    logger.error("Remotion completely timed out after 10 minutes!")
                    raise ValueError("Remotion process permanently froze and timed out.")            
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
        # Universal mode: use generic scene cards so no empty customer data leaks
        # into the Remotion visual scenes.
        if is_universal:
            scene = self.build_universal_scene_payload(request)
        else:
            scene = self.build_scene_payload(request, request.tos or "0", request.loan_amount or "", "elevated")
        render_p = self.build_render_payload(request, tts['video_id'], tts['text'], tts['audio_path'], tts['vtt_path'], scene)
        video_url = await self.render_video(request, tts['video_id'], scene, render_p)
        return {
            "video_url": video_url,
            "video_path": settings.output_dir / video_url.lstrip('/'),
            "audio_path": self.remotion_path / "public" / tts['audio_path'].lstrip('/'),
            "audio_url": tts['audio_path'],
            "video_id": tts['video_id'], 
            "text": tts['text']
        }

    async def _persist_logo_asset(self, file_content: bytes, filename: str) -> str:
        (self.assets_path / filename).write_bytes(file_content)
        return filename
