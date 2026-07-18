from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)


def test_liveness() -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_when_dependencies_are_available(monkeypatch) -> None:
    monkeypatch.setattr(main, "database_ready", AsyncMock())
    monkeypatch.setattr(main, "cache_ready", AsyncMock())

    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"database": "ok", "cache": "ok"},
    }


def test_readiness_when_database_is_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "database_ready",
        AsyncMock(side_effect=ConnectionError("database unavailable")),
    )
    monkeypatch.setattr(main, "cache_ready", AsyncMock())

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "status": "not_ready",
        "checks": {"database": "error", "cache": "ok"},
    }
