from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import admin_auth


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = value

    async def delete(self, key):
        self.values.pop(key, None)

    async def incr(self, key):
        value = int(self.values.get(key, 0)) + 1
        self.values[key] = value
        return value

    async def expire(self, key, ttl):
        return True

    async def ttl(self, key):
        return 28_800


def configure(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(admin_auth, "redis_client", fake)
    monkeypatch.setattr(
        admin_auth,
        "get_settings",
        lambda: SimpleNamespace(
            ADMIN_USER="operator", ADMIN_PASSWORD="strong-password", ENVIRONMENT="test"
        ),
    )
    app = FastAPI()
    app.include_router(admin_auth.router, prefix="/auth")
    return TestClient(app)


def test_login_session_logout(monkeypatch):
    with configure(monkeypatch) as client:
        login = client.post(
            "/auth/login",
            json={"username": "operator", "password": "strong-password"},
            headers={"Origin": "http://testserver"},
        )
        assert login.status_code == 200
        assert "HttpOnly" in login.headers["set-cookie"]
        assert "SameSite=strict" in login.headers["set-cookie"]
        assert client.get("/auth/session").status_code == 200
        assert (
            client.post(
                "/auth/logout", headers={"Origin": "http://testserver"}
            ).status_code
            == 200
        )
        assert client.get("/auth/session").status_code == 401


def test_login_rate_limit(monkeypatch):
    with configure(monkeypatch) as client:
        for _ in range(5):
            assert (
                client.post(
                    "/auth/login",
                    json={"username": "operator", "password": "wrong"},
                    headers={"Origin": "http://testserver"},
                ).status_code
                == 401
            )
        assert (
            client.post(
                "/auth/login",
                json={"username": "operator", "password": "wrong"},
                headers={"Origin": "http://testserver"},
            ).status_code
            == 429
        )
