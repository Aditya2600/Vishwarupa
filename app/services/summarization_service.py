import os
import time
import logging
from dotenv import load_dotenv
import google.generativeai as genai
from app.config import settings

# Force .env to override any stale system environment variables
load_dotenv(override=True)

logger = logging.getLogger("app")

class SummarizationService:
    def __init__(self):
        # Read directly from env (post-override) to ensure .env key is used
        self.api_key = os.getenv('GEMINI_API_KEY') or getattr(settings, 'gemini_api_key', None)
        self.model_name = os.getenv('GEMINI_MODEL_NAME') or getattr(settings, 'gemini_model_name', 'gemini-2.0-flash')

        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
        else:
            self.model = None
            logger.warning("GEMINI_API_KEY not found in settings. Summarization will fail.")

    async def summarize_text(self, text: str, target_language: str = "Hindi", gender: str = "Female") -> str:
        """
        Summarizes the provided text into the target language using Gemini AI.
        Produces a spoken-style WhatsApp message in the requested language.
        Gender affects Hindi grammar in the greeting.
        """
        if not self.model:
            raise RuntimeError("Gemini AI is not configured. Please check your GEMINI_API_KEY.")
        
        prompt = (
            f"TASK: Create a BALANCED and AUTHORITATIVE spoken script for a WhatsApp voice message in {target_language} based on this legal/loan notice.\n\n"
            f"CRITICAL: The output MUST be in PURE {target_language}. Avoid 'Hinglish' or mixing English words unless they are proper nouns (Bank Name) or IDs.\n\n"
            "INSTRUCTIONS:\n"
            "- FIRST extract the organization name (e.g., 'Abhiyan Capital').\n"
            "- Start with a formal notice greeting (NOT a live phone call). For example: 'Namaste, this is an important legal notice summary from [BANK_NAME].' (Translate this naturally into the target language).\n"
            "- Provide a CLEAR and HIGHLIGHTED summary about 4-5 sentences long. Include the Recipient Name, Loan ID, and the exact Outstanding Amount.\n"
            "- Briefly state the core reason for the notice (e.g., cheque bounce or missed EMI) without getting lost in excessive legal jargon.\n"
            "- Mention the primary consequence of non-payment (e.g., legal action or credit score impact).\n"
            "- EXCLUDE administrative dates like the 'Date the notice was sent'. Only focus on deadlines.\n"
            "- Tone: Serious, professional, and authoritative.\n"
            "- ACCURACY: Use exact figures and IDs from the source.\n\n"
            f"SOURCE TEXT:\n{text}\n\n"
            f"OUTPUT ONLY THE {target_language} MESSAGE (Greeting -> Core Context -> Financials -> Consequence -> Closing):"
        )

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error during Gemini summarization: {e}")
            raise RuntimeError(f"Summarization failed: {str(e)}")

