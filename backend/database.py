"""
MongoDB Database Connection and Lifespan Initialization using Motor.
Provides async database access and collection index initialization.
"""

import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("uvicorn.info")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "teaching_to_reel_db")

client: AsyncIOMotorClient = None
db = None

def _safe_uri(uri: str) -> str:
    """Hide the username and password before a connection string is written to logs."""
    if "@" not in uri:
        return uri
    scheme, _, rest = uri.partition("://")
    return f"{scheme}://***:***@{rest.split('@', 1)[1]}"

def get_database():
    """Return the active async MongoDB database instance."""
    return db

async def connect_to_mongo():
    """Initializes MongoDB client and creates essential indexes."""
    global client, db
    try:
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        logger.info(f"Connected to MongoDB at {_safe_uri(MONGODB_URI)}, Database: {DATABASE_NAME}")

        # Ensure unique indexes and efficient query paths
        # Firebase decides who a user is; firebaseUid is the unique key.
        await db.users.create_index("firebaseUid", unique=True, sparse=True)
        await db.users.create_index("email")
        await db.user_profiles.create_index("userId", unique=True)
        await db.user_queries.create_index([("userId", 1), ("createdAt", -1)])
        await db.generated_reels.create_index([("userId", 1), ("createdAt", -1)])
        await db.verified_teachings.create_index("id", unique=True)
        await db.verified_teachings.create_index("themes")
        logger.info("MongoDB collections and indexes successfully verified.")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise e

async def close_mongo_connection():
    """Closes MongoDB connection on application shutdown."""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")
