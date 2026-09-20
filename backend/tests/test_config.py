from app.core.config import Settings


def test_database_urls_use_explicit_drivers(monkeypatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:password@database:5432/catalogue",
    )
    settings = Settings(_env_file=None)

    assert settings.DATABASE_URL.startswith("postgresql+asyncpg://")
    assert settings.SYNC_DATABASE_URL.startswith("postgresql+psycopg://")
