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
drafts_collection = db['drafts']
custom_avatars_collection = db['custom_avatars']
whatsapp_templates_collection = db["whatsapp_templates"]
pdf_collection = db["pdf_summaries"]
whatsapp_logs_collection = db['whatsapp_logs']
