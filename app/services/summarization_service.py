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
        Summarizes the provided PDF/document text into the target language using Gemini AI.
        Produces a concise spoken-style summary suitable for audio narration.
        Gender affects Hindi grammar in the greeting.
        """
        if not self.model:
            raise RuntimeError("Gemini AI is not configured. Please check your GEMINI_API_KEY.")
        
        prompt = (
            f"TASK: Create a clear, concise spoken-style summary of the following PDF/document in {target_language}.\n\n"
            f"CRITICAL: The output MUST be in PURE {target_language}. Avoid 'Hinglish' or mixing English words unless they are proper nouns, IDs, or unavoidable document terms.\n\n"
            "INSTRUCTIONS:\n"
            "- Summarize the document itself, not just legal notices or loan letters.\n"
            "- Focus on the key facts, names, amounts, dates, obligations, deadlines, and outcomes that appear in the PDF.\n"
            "- If the PDF does not contain some detail, do not invent it.\n"
            "- Keep it concise, professional, and easy to read aloud.\n"
            "- Prefer 4-6 short sentences unless the document is very short.\n"
            "- Preserve exact figures, IDs, and proper nouns where they appear.\n\n"
            f"SOURCE TEXT:\n{text}\n\n"
            f"OUTPUT ONLY THE {target_language} SUMMARY:"
        )

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error during Gemini summarization: {e}")
            raise RuntimeError(f"Summarization failed: {str(e)}")

