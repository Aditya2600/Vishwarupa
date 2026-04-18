import os
import logging
import httpx
from dotenv import load_dotenv
from app.config import settings

# Force .env to override any stale system environment variables
load_dotenv(override=True)

logger = logging.getLogger("app")

class SummarizationService:
    def __init__(self):
        # xAI (Grok) Configuration
        self.xai_api_key = os.getenv('XAI_API_KEY') or getattr(settings, 'xai_api_key', None)
        self.xai_model_name = os.getenv('XAI_MODEL_NAME') or getattr(settings, 'xai_model_name', 'grok-4-1-fast-reasoning')

        # Gemini Configuration (Stored in code but currently not primary)
        self.gemini_api_key = os.getenv('GEMINI_API_KEY') or getattr(settings, 'gemini_api_key', None)
        self.gemini_model_name = os.getenv('GEMINI_MODEL_NAME') or getattr(settings, 'gemini_model_name', 'gemini-2.0-flash')

        # Initialize xAI
        if self.xai_api_key:
            logger.info(f"SummarizationService: xAI initialized (Model: {self.xai_model_name})")
        
        # Initialize Gemini (Kept in code normally as requested)
        if self.gemini_api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_api_key)
                self.gemini_model = genai.GenerativeModel(self.gemini_model_name)
                logger.info(f"SummarizationService: Gemini logic loaded and ready")
            except Exception as e:
                logger.warning(f"SummarizationService: Gemini pre-load failed: {e}")

    async def summarize_text(self, text: str, target_language: str = "Hindi", gender: str = "Female") -> str:
        """
        Summarizes the provided PDF/document text. 
        HARDCODED to use xAI (Grok) only.
        """
        if not self.xai_api_key:
            raise RuntimeError("xAI API is not configured. Please check your XAI_API_KEY.")

        # RESTORED PROMPT: Exactly as in the original version
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

        # HARDCODED: Call xAI directly. No automatic fallback to Gemini.
        return await self._summarize_with_xai(prompt)

    async def _summarize_with_xai(self, prompt: str) -> str:
        url = "https://api.x.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.xai_api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": self.xai_model_name,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that summarizes legal and formal documents for narration."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(url, headers=headers, json=data)
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"].strip()
            except Exception as e:
                logger.error(f"xAI Summarization Error: {e}")
                raise

    async def _summarize_with_gemini(self, prompt: str) -> str:
        """
        Kept in code for future use, but not called in the current hardcoded flow.
        """
        if not hasattr(self, 'gemini_model'):
            raise RuntimeError("Gemini model not initialized.")
            
        import asyncio
        response = await asyncio.to_thread(self.gemini_model.generate_content, prompt)
        return response.text.strip()
