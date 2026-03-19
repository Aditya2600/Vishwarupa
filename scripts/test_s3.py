import sys
from pathlib import Path

# Add the project root to sys.path so we can import 'app'
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from app.services.s3_service import S3Service
from app.config import settings

def test_s3_upload():
    print("--- S3 Upload Test ---")
    print(f"Bucket: {settings.s3_bucket_name}")
    print(f"Region: {settings.aws_region}")
    
    if not settings.aws_access_key_id or not settings.aws_secret_access_key:
        print("ERROR: AWS credentials not found in settings!")
        return

    s3_service = S3Service()
    
    # Create a small dummy file to test upload
    test_file = project_root / "output" / "test_s3_upload.txt"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text("This is a test file for S3 upload.")
    
    print(f"Attemting to upload {test_file.name}...")
    
    try:
        url = s3_service.upload_video(test_file, "tests/test_upload.txt")
        if url:
            print(f"SUCCESS! File uploaded to: {url}")
        else:
            print("FAILED: s3_service.upload_video returned None. Check logs.")
    except Exception as e:
        print(f"EXCEPTION: {str(e)}")
    finally:
        if test_file.exists():
            test_file.unlink()

if __name__ == "__main__":
    test_s3_upload()
