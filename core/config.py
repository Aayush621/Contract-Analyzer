from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str
    MONGO_DB_NAME: str
    REDIS_URI: str
    UPLOADS_DIR: str = "uploads"

    class Config:
        env_file = ".env"

settings = Settings()