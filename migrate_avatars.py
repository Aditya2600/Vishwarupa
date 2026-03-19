import asyncio
import os
import motor.motor_asyncio
from dotenv import load_dotenv

# Load connection string
load_dotenv(".env")
MONGODB_URI = os.getenv("MONGODB_URI")

async def migrate_avatars():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
    db = client.heygen_db
    collection = db.custom_avatars

    # Clear existing to avoid duplicates if re-run
    await collection.delete_many({})

    # Exact definitions from config.py / main.py
    custom_avatars = [
        {
            "avatar_id": "2311cba09f374de6b971ea5fa23ff993",
            "avatar_name": "Mahesh",
            "gender": "male",
            "preview_image_url": "/mahesh.png",
            "style": "Lead Avatar",
            "is_premium": False
        },
        {
            "avatar_id": "932371fea0eb462ea9beccff656d4823",
            "avatar_name": "Rahul",
            "gender": "male",
            "preview_image_url": "/rahul.jpg",
            "style": "Lead Avatar",
            "is_premium": False
        },
        {
            "avatar_id": "c56120f1c7564d20b1f87416a6b8d0d1",
            "avatar_name": "Priya",
            "gender": "female",
            "preview_image_url": "/priya.png",
            "style": "Lead Avatar",
            "is_premium": False
        },
        {
            "avatar_id": "b8d00c953a114b299792b6197a80cc70",
            "avatar_name": "Adv. Aditi Mehra",
            "gender": "female",
            "preview_image_url": "/Adv_ Aditi_Mehra.png",
            "style": "Lead Avatar",
            "is_premium": False
        }
    ]

    result = await collection.insert_many(custom_avatars)
    print(f"✅ Successfully inserted {len(result.inserted_ids)} avatars into the 'custom_avatars' MongoDB collection!")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_avatars())
