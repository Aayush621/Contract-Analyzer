from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str
    MONGO_DB_NAME: str
    REDIS_URI: str
    UPLOADS_DIR: str = "uploads"

    # CORS
    CORS_ALLOW_ORIGINS: str = "*"        # comma-separated list or "*"
    CORS_ALLOW_METHODS: str = "*"        # e.g. "GET,POST,PUT,DELETE"
    CORS_ALLOW_HEADERS: str = "*"        # e.g. "Authorization,Content-Type"
    CORS_ALLOW_CREDENTIALS: bool = False

    class Config:
        env_file = ".env"

settings = Settings()