import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

def get_password_hash(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

async def init_admin():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client.heygen_db
    collection = db.users
    
    admin_email = "admin@credresolve.com"
    admin_password = "54321"
    hashed_pw = get_password_hash(admin_password)
    
    # Check if exists
    existing = await collection.find_one({"email": admin_email})
    if not existing:
        await collection.insert_one({
            "email": admin_email,
            "hashed_password": hashed_pw,
            "full_name": "System Admin",
            "is_admin": True,
            "disabled": False
        })
        print(f"✅ Created new Admin user: {admin_email}")
    else:
        await collection.update_one(
            {"email": admin_email},
            {"$set": {"is_admin": True, "hashed_password": hashed_pw}}
        )
        print(f"ℹ️ Updated existing user to Admin: {admin_email}")

if __name__ == "__main__":
    asyncio.run(init_admin())
