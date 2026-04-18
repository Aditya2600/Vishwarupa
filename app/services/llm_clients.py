import os
import httpx
import asyncio
import logging
from app.config import settings

logger = logging.getLogger("app")

class GrokClient:
    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        self.base_url = "https://api.x.ai/v1/chat/completions"

    async def generate(self, prompt: str) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that summarizes legal and formal documents for narration."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.base_url, headers=headers, json=data)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"].strip()

class GeminiClient:
    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        self.model = None
        self._initialize()

    def _initialize(self):
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
        except Exception as e:
            logger.error(f"GeminiClient: Failed to initialize: {e}")

    async def generate(self, prompt: str) -> str:
        if not self.model:
            raise RuntimeError("GeminiClient not initialized correctly.")
        
        # Run in thread to keep it async-friendly
        response = await asyncio.to_thread(self.model.generate_content, prompt)
        return response.text.strip()
