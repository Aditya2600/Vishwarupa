import asyncio
import os
import logging
from pathlib import Path
from app.config import settings
from app.database import pdf_collection
from app.services.s3_service import S3Service
from bson import ObjectId
import edge_tts

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
}

class AudioService:
    def __init__(self):
        self.s3_service = S3Service()
        self.output_dir = Path(settings.default_output_dir) / "pdf_audio"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        # Semaphore to limit concurrent audio generation requests to 1
        # This prevents hammering edge-tts with multiple concurrent requests
        self.audio_generation_semaphore = asyncio.Semaphore(1)
        logger.info("AudioService initialized with request queuing (max 1 concurrent audio generation)")

    async def generate_audio(self, pdf_id: str, text: str, language: str = "Hindi", gender: str = "Female", prefix: str = "summary") -> str:
        # Acquire semaphore permit - only 1 audio generation at a time
        async with self.audio_generation_semaphore:
            logger.info(f"AudioService: Processing audio request for PDF {pdf_id} (queued requests handled)")
            


            voice_key = f"{language}-{gender.capitalize()}"
            voice = VOICE_MAP.get(voice_key, VOICE_MAP.get("Hindi-Female"))

            output_filename = f"{prefix}_{pdf_id}.mp3"
            local_path = self.output_dir / output_filename

            logger.info(f"Generating audio for PDF {pdf_id} using voice {voice}")

            # Use edge_tts Python API directly — avoids subprocess issues on Windows
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(local_path))

            logger.info(f"Audio saved to {local_path}")

            # Upload to S3 if configured
            s3_url = None
            if settings.aws_access_key_id:
                try:
                    s3_key = f"pdf_audio/{output_filename}"
                    s3_url = await asyncio.to_thread(
                        self.s3_service.upload_file, 
                        str(local_path), 
                        s3_key,
                        "audio/mpeg"
                    )
                    logger.info(f"Uploaded audio to S3: {s3_url}")
                except Exception as e:
                    logger.error(f"S3 Upload failed for PDF {pdf_id}: {e}")
                    raise RuntimeError(f"S3 upload failed for PDF {pdf_id}: {e}") from e

                if not s3_url:
                    raise RuntimeError(f"S3 upload failed for PDF {pdf_id}")

            final_url = s3_url or f"/api/pdf/audio/{output_filename}"

            # store audio URL under different keys depending on prefix
            update_field = "audio_url" if prefix == "summary" else f"{prefix}_audio_url"
            await pdf_collection.update_one(
                {"_id": ObjectId(pdf_id)},
                {"$set": {update_field: final_url}}
            )

            # TOP-NOTCH: Cleanup local file after S3 upload to save disk space
            if s3_url and local_path.exists():
                try:
                    os.remove(local_path)
                    logger.info(f"Cleaned up local audio file: {local_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete local audio file: {e}")

            return final_url

audio_service = AudioService()
