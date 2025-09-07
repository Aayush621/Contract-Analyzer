from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db = MongoDB()

async def connect_to_mongo():
    print("Connecting to MongoDB...")
    # For MongoDB Atlas, use the connection string directly
    db.client = AsyncIOMotorClient(settings.MONGO_URI)
    db.db = db.client[settings.MONGO_DB_NAME]
    print("Successfully connected to MongoDB.")

async def close_mongo_connection():
    print("Closing MongoDB connection...")
    db.client.close()
    print("MongoDB connection closed.")

def get_collection(name: str):
    return db.db[name]