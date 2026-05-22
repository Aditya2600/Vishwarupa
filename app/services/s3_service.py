import boto3
from pathlib import Path
from app.config import settings
from app.constants import S3_BUCKET_NAME
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
        self.bucket = S3_BUCKET_NAME

    def upload_video(self, local_path: Path, s3_key: str) -> str | None:
        """Uploads a video to S3 and returns the public URL. Returns None if S3 is not configured."""
        return self.upload_file(local_path, s3_key, content_type='video/mp4')

    def upload_file(self, local_path: str | Path, s3_key: str, content_type: str = 'application/octet-stream') -> str | None:
        """Uploads any file to S3 and returns the public URL. Returns None if S3 is not configured."""
        if not self.s3 or not self.bucket:
            logger.info("S3 credentials or bucket missing. Skipping upload.")
            return None
            
        path_obj = Path(local_path)
        if not path_obj.exists():
            logger.error(f"File {path_obj} does not exist. Cannot upload to S3.")
            return None

        try:
            self.s3.upload_file(
                str(path_obj), 
                self.bucket, 
                s3_key,
                ExtraArgs={'ContentType': content_type}
            )
            return f"https://{self.bucket}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"
        except Exception as e:
            logger.error(f"Failed to upload to S3: {e}")
            return None

    def generate_presigned_s3_url(self, s3_key: str, expires_in: int = 604800) -> str | None:
        """Returns a temporary download URL for any private S3 object."""
        if not self.s3 or not self.bucket:
            logger.info("S3 credentials or bucket missing. Skipping presigned URL generation.")
            return None

        try:
            return self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': s3_key},
                ExpiresIn=expires_in,
            )
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {s3_key}: {e}")
            return None

    def presign_s3_url(self, asset_url: str | None) -> str | None:
        if not asset_url:
            return asset_url

        # Handle various S3 URL formats or if it's already a key
        s3_key = None
        
        # Format 1: https://bucket.s3.region.amazonaws.com/key
        prefix = f"https://{self.bucket}.s3.{settings.aws_region}.amazonaws.com/"
        if asset_url.startswith(prefix):
            s3_key = asset_url[len(prefix):]
        
        # Format 2: https://bucket.s3.amazonaws.com/key (Legacy/Direct)
        elif asset_url.startswith(f"https://{self.bucket}.s3.amazonaws.com/"):
            s3_key = asset_url[len(f"https://{self.bucket}.s3.amazonaws.com/"):]
            
        # Format 3: Just the key itself
        elif (
            "/" not in asset_url
            or asset_url.startswith("notices/")
            or asset_url.startswith("videos/")
            or asset_url.startswith("pdf_audio/")
            or asset_url.startswith("interactive/")
        ):
            s3_key = asset_url
            
        if not s3_key:
            return asset_url

        return self.generate_presigned_s3_url(s3_key) or asset_url
