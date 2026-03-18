from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGODB_URI")
client = MongoClient(uri)
db = client.heygen_db

total = db.videos.count_documents({})
print(f"Total: {total}")

remotion = list(db.videos.find({"request_mode": "remotion"}))
print(f"Total remotion: {len(remotion)}")
for v in remotion:
    print(v.get("title"), v.get("status"), v.get("created_at"))
