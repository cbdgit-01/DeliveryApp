from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Database - Check env var directly to avoid pydantic issues
    # Railway provides DATABASE_URL for PostgreSQL
    @property
    def database_url(self) -> str:
        return os.environ.get("DATABASE_URL", "sqlite:///./delivery_app.db")
    
    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_hours: int = 24
    
    # Shopify
    shopify_api_key: str = ""
    shopify_api_secret: str = ""
    shopify_shop_url: str = ""
    shopify_access_token: str = ""
    shopify_webhook_secret: str = ""
    
    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    
    # App
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    scheduler_phone: str = ""
    
    # Environment
    environment: str = "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()





