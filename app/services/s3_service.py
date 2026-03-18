import boto3
from pathlib import Path
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        ) if settings.aws_access_key_id and settings.aws_secret_access_key else None
        self.bucket = settings.s3_bucket_name

    def upload_video(self, local_path: Path, s3_key: str) -> str | None:
        """Uploads a video to S3 and returns the public URL. Returns None if S3 is not configured."""
        if not self.s3 or not self.bucket:
            logger.info("S3 credentials or bucket missing. Skipping upload.")
            return None
            
        if not local_path.exists():
            logger.error(f"File {local_path} does not exist. Cannot upload to S3.")
            return None

        try:
            self.s3.upload_file(
                str(local_path), 
                self.bucket, 
                s3_key,
                ExtraArgs={'ContentType': 'video/mp4'}
            )
            return f"https://{self.bucket}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"
        except Exception as e:
            logger.error(f"Failed to upload to S3: {e}")
            return None
