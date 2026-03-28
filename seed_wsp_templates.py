"""
Seed script: upserts default WhatsApp campaign templates into MongoDB.
Run anytime: python seed_wsp_templates.py
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
    {
        "id": "test3",
        "templateId": "34899727692974205",
        "name": "test3",
        "desc": "Account Status Update Strategy",
        "color": "emerald",
        "whatsapp": (
            "Hello,\n\nAn update regarding your account has been shared by CredResolve.\n"
            "Kindly watch the video and take the necessary action.\n\n"
            "Thank you."
        ),
        "scriptPersonalized": (
            "Hello {{customer_name}}. An update regarding your account has been "
            "shared by CredResolve. Kindly watch the information in this video "
            "and take the necessary action. Thank you."
        ),
        "scriptUniversal": (
            "Hello. An update regarding your account has been shared by "
            "CredResolve. Kindly watch the information in this video and "
            "take the necessary action. Thank you."
        ),
    },
]



async def seed():
    inserted = 0
    updated = 0
    for tmpl in TEMPLATES:
        result = await col.update_one(
            {"id": tmpl["id"]},
            {"$set": tmpl},
            upsert=True,
        )
        if result.upserted_id is not None:
            print(f"  INSERT '{tmpl['id']}' — {tmpl['name']}")
            inserted += 1
        elif result.modified_count > 0:
            print(f"  UPDATE '{tmpl['id']}' — {tmpl['name']}")
            updated += 1
        else:
            print(f"  OK     '{tmpl['id']}' already up to date.")

    print(f"\nDone. {inserted} inserted, {updated} updated.")


if __name__ == "__main__":
    asyncio.run(seed())
