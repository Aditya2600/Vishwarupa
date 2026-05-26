import asyncio
from app.database import videos_collection
from bson import ObjectId

async def main():
    doc = await videos_collection.find_one({"_id": ObjectId("6a115a7713183d6594be4e72")})
    import json
    print(json.dumps(doc, default=str, indent=2))

asyncio.run(main())
