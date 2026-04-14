import os
import logging
import httpx
from io import BytesIO
from pathlib import Path
from pypdf import PdfReader

logger = logging.getLogger("app")

class PDFService:
    @staticmethod
    def extract_text(pdf_path: str | Path) -> str:
        """
        Extracts all text from a given PDF file.
        """
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from PDF {pdf_path}: {e}")
            raise RuntimeError(f"Failed to parse PDF: {str(e)}")

    @staticmethod
    async def extract_text_from_url(pdf_url: str) -> str:
        """
        Downloads a PDF from a URL and extracts text in-memory.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(pdf_url, follow_redirects=True)
                response.raise_for_status()
                
                pdf_file = BytesIO(response.content)
                reader = PdfReader(pdf_file)
                text = ""
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from URL {pdf_url}: {e}")
            raise RuntimeError(f"Failed to process remote PDF: {str(e)}")

    @staticmethod
    def save_upload(file_content: bytes, filename: str) -> Path:
        """
        Saves the uploaded bytes to the local input/pdf directory.
        """
        upload_dir = Path("input/pdf")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = upload_dir / filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        return file_path
