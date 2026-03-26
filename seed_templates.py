import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def seed_templates():
    # Production MongoDB Atlas connection
    uri = "mongodb+srv://khushianand:Khushi28Anand@cluster0.cqdd09o.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client['personalized_video_gen']
    collection = db['whatsapp_templates']
    
    # Official Infobip CPSTest template
    cpstest_template = {
        "id": "cpstest",
        "name": "Infobip CPSTest",
        "desc": "Official WhatsApp template for debt recovery.",
        "color": "indigo",
        "whatsapp": "This is regarding loan due. Kindly follow the video for more information.",
        "scriptPersonalized": "Hello {{customer_name}}. This is regarding your outstanding loan due with CredResolve. Kindly follow the information in this video for more details and repayment options.",
        "scriptUniversal": "This is regarding your outstanding loan due. Kindly follow the information in this video for more details and repayment options."
    }
    
    # Check if exists
    existing = await collection.find_one({"id": "cpstest"})
    if not existing:
        await collection.insert_one(cpstest_template)
        print("✅ Successfully seeded Infobip CPSTest template to Database.")
    else:
        print("ℹ️ CPSTest template already exists in Database.")

if __name__ == "__main__":
    asyncio.run(seed_templates())
