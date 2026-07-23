import logging
from functools import lru_cache
import os

from pydantic_settings import BaseSettings, SettingsConfigDict

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
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "qiymetleri.com API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    COMPARISON_WRITE_MODE: str = "off"
    CATALOGUE_MODEL_READ: str = "legacy"
    COMPARISON_API_ENABLED: bool = False
    SPEC_IMPORT_SIGNING_KEY: str = "CHANGE_ME_SPEC_IMPORT_KEY"

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
            return url.replace(
                "postgresql+asyncpg://", "postgresql+psycopg://", 1
            ).replace("postgresql://", "postgresql+psycopg://", 1)
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis — separate URLs keep API cache and Celery traffic isolated.
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    def _default_redis_url(self, database: int) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{database}"

    @property
    def CACHE_REDIS_URL(self) -> str:
        return os.getenv(
            "CACHE_REDIS_URL", os.getenv("REDIS_URL", self._default_redis_url(0))
        )

    @property
    def CELERY_BROKER_URL(self) -> str:
        return os.getenv("CELERY_BROKER_URL", self._default_redis_url(1))

    @property
    def CELERY_RESULT_BACKEND(self) -> str:
        return os.getenv("CELERY_RESULT_BACKEND", self._default_redis_url(2))

    @property
    def REDIS_URL(self) -> str:
        """Backward-compatible alias for cache integrations."""
        return self.CACHE_REDIS_URL

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


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_admin_credentials()
    return settings
