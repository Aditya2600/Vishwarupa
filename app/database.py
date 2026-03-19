import motor.motor_asyncio
from app.config import settings
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = client.heygen_db

users_collection = db.users
videos_collection = db.videos
video_jobs_collection = db.video_jobs
drafts_collection = db.drafts
custom_avatars_collection = db.custom_avatars
