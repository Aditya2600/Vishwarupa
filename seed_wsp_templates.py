"""
Seed script: inserts default WhatsApp campaign templates into MongoDB.
Run once: python seed_wsp_templates.py
"""
import asyncio
import os
from dotenv import load_dotenv
import motor.motor_asyncio

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = client.heygen_db
col = db["whatsapp_templates"]

TEMPLATES = [
    {
        "id": "cpstest",
        "name": "Infobip CPSTest",
        "desc": "Official WhatsApp template for debt recovery.",
        "color": "indigo",
        "whatsapp": "This is regarding loan due. Kindly follow the video for more information.",
        "scriptPersonalized": (
            "Hello {{customer_name}}. This is regarding your outstanding loan due with "
            "CredResolve. Kindly follow the information in this video for more details "
            "and repayment options."
        ),
        "scriptUniversal": (
            "This is regarding your outstanding loan due. Kindly follow the information "
            "in this video for more details and repayment options."
        ),
    },
]



async def seed():
    inserted = 0
    skipped = 0
    for tmpl in TEMPLATES:
        existing = await col.find_one({"id": tmpl["id"]})
        if existing:
            print(f"  SKIP  '{tmpl['id']}' already exists.")
            skipped += 1
        else:
            await col.insert_one(tmpl)
            print(f"  INSERT '{tmpl['id']}' — {tmpl['name']}")
            inserted += 1

    print(f"\nDone. {inserted} inserted, {skipped} skipped.")


if __name__ == "__main__":
    asyncio.run(seed())
