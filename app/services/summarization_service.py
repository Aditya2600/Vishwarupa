import os
import logging
from pathlib import Path
from app.config import settings
from app.services.llm_clients import GrokClient

logger = logging.getLogger("app")

class SummarizationService:
    def __init__(self):
        # Initialize Clients
        self.grok = self._init_grok()
        
        # Load external prompt
        self.prompt_template = self._load_prompt_template()

    def _init_grok(self) -> GrokClient:
        api_key = os.getenv('XAI_API_KEY') or getattr(settings, 'xai_api_key', None)
        model = os.getenv('XAI_MODEL_NAME') or getattr(settings, 'xai_model_name', 'grok-4-1-fast-reasoning')
        if api_key:
            return GrokClient(api_key, model)
        return None



    def _load_prompt_template(self) -> str:
        prompt_path = Path(__file__).parent.parent / "prompts" / "summarization_prompt.txt"
        try:
            return prompt_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.error(f"SummarizationService: Failed to load prompt from {prompt_path}: {e}")
            return ""

    async def summarize_text(self, text: str, target_language: str = "Hindi", gender: str = "Female") -> str:
        """
        Coordinating service that uses the hardcoded Grok engine.
        """
        if not self.grok:
            raise RuntimeError("GrokClient not configured (XAI_API_KEY missing).")

        if not self.prompt_template:
            raise RuntimeError("Summarization prompt template missing.")

        # Format the prompt from the external template
        prompt = self.prompt_template.format(
            target_language=target_language,
            text=text
        )

        # Call Grok specifically for PDF tasks
        return await self.grok.generate(prompt)
