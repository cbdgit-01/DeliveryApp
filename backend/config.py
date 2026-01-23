from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Database - Try multiple env var names
    # Railway can use DATABASE_URL or POSTGRES_URL
    @property
    def database_url(self) -> str:
        # Check for PostgreSQL URL in various forms
        pg_url = (
            os.environ.get("POSTGRES_URL") or  # Try this first (custom)
            os.environ.get("DATABASE_PRIVATE_URL") or
            os.environ.get("DATABASE_URL") or
            "sqlite:///./delivery_app.db"
        )
        return pg_url
    
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
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()





