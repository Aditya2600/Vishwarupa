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
            f"CRITICAL: The output MUST be in PURE {target_language}. Avoid Hinglish or mixing English words unless they are proper nouns, IDs, company names, or unavoidable document terms.\n\n"
            "You read formal notices such as legal notices, banking notices, finance recovery letters, government notices, and compliance notices. "
            "Understand the real topic of the notice and explain it in simple language. Do not give legal advice. "
            "If the document is not a notice, give a normal document summary instead.\n\n"
            "INSTRUCTIONS:\n"
            "- First decide whether the PDF is a notice or a normal document.\n"
            "- If it is a notice, summarize only the real notice points and the action required.\n"
            "- If it is not a notice, summarize it normally without forcing notice-style wording.\n"
            "- Summarize only the important substance of the PDF.\n"
            "- Omit boilerplate, background history, repetitive legal phrasing, and filler lines unless they are essential to the main message.\n"
            "- Do NOT repeat introductory descriptions like former names, old company identities, or long organizational histories unless they change the meaning of the notice.\n"
            "- Do NOT include letterhead details, sender/signature blocks, advocate names, office addresses, phone numbers, email IDs, or decorative footer/header text unless they are essential to the notice itself.\n"
            "- Focus on the core facts: who the document is about, what the issue is, what amount/date/obligation is involved, and what action is required.\n"
            "- If the PDF is a notice, capture the actual notice points, not every formal paragraph.\n"
            "- If the PDF is not a notice, still keep the summary generic and document-focused.\n"
            "- Do not invent or assume any names, dates, numbers, amounts, clauses, or facts that are not explicitly present in the PDF.\n"
            "- If the PDF does not contain some detail, leave it out.\n"
            "- Keep it detailed enough to capture the notice's key points, but still professional and easy to read aloud.\n"
            "- Prefer 5-8 short sentences unless the document is very short.\n"
            "- Preserve exact figures, IDs, names, and proper nouns where they matter.\n\n"
            f"SOURCE TEXT:\n{text}\n\n"
            f"OUTPUT ONLY THE {target_language} SUMMARY:"
        )

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error during Gemini summarization: {e}")
            raise RuntimeError(f"Summarization failed: {str(e)}")

