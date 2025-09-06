from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings
import ssl

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db = MongoDB()

async def connect_to_mongo():
    print("Connecting to MongoDB...")
    # Create SSL context for MongoDB Atlas
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    db.client = AsyncIOMotorClient(
        settings.MONGO_URI,
        ssl=True,
        ssl_cert_reqs=ssl.CERT_NONE,
        ssl_context=ssl_context
    )
    db.db = db.client[settings.MONGO_DB_NAME]
    print("Successfully connected to MongoDB.")

async def close_mongo_connection():
    print("Closing MongoDB connection...")
    db.client.close()
    print("MongoDB connection closed.")

def get_collection(name: str):
    return db.db[name]