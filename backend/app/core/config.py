import logging
from functools import lru_cache
import os

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

_INSECURE_PASSWORDS = frozenset(
    {
        "changeme",
        "password",
        "admin",
        "admin123",
        "123456",
        "secret",
    }
)


class Settings(BaseSettings):
    PROJECT_NAME: str = "qiymetleri.com API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # PostgreSQL
    POSTGRES_USER: str = "qiymetleri"
    POSTGRES_PASSWORD: str = "CHANGE_ME_SET_VIA_ENV"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "qiymetleri"

    @property
    def DATABASE_URL(self) -> str:
        url = os.getenv("DATABASE_URL", "")
        if url:
            # Supabase/Render provide postgresql:// — convert to asyncpg
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        url = os.getenv("DATABASE_URL", "")
        if url:
            return url
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis — supports full URL (Upstash/managed) or host/port (local Docker)
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    @property
    def REDIS_URL(self) -> str:
        # REDIS_URL env var takes priority (Upstash: rediss://...)
        url = os.getenv("REDIS_URL", "")
        if url:
            return url
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Admin credentials — MUST be set via environment variables in production
    ADMIN_USER: str = "admin"
    ADMIN_PASSWORD: str = "changeme"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "https://qiymetleri.com",
        "https://www.qiymetleri.com",
        "https://qiymetleri.vercel.app",
    ]

    def validate_admin_credentials(self) -> None:
        """Warn if admin credentials are insecure defaults."""
        if self.ADMIN_PASSWORD.lower() in _INSECURE_PASSWORDS:
            logger.warning(
                "ADMIN_PASSWORD is set to an insecure default ('%s'). "
                "Set a strong ADMIN_PASSWORD environment variable before deploying to production.",
                self.ADMIN_PASSWORD,
            )

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_admin_credentials()
    return settings
