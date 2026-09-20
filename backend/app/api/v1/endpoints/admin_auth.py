import hashlib
import secrets

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.api.dependencies import SESSION_COOKIE
from app.core.cache import redis_client
from app.core.config import get_settings
from app.core.origin import require_trusted_origin

router = APIRouter()
SESSION_TTL = 8 * 60 * 60
RATE_WINDOW = 15 * 60
MAX_FAILURES = 5


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=500)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    settings = get_settings()
    require_trusted_origin(request, settings.BACKEND_CORS_ORIGINS)
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    client_ip = forwarded or (request.client.host if request.client else "unknown")
    rate_key = f"admin:login:{_hash(f'{client_ip}:{payload.username.lower()}')}"
    failures = int(await redis_client.get(rate_key) or 0)
    if failures >= MAX_FAILURES:
        raise HTTPException(
            status_code=429,
            detail="Çox sayda uğursuz cəhd. 15 dəqiqə sonra yenidən yoxlayın.",
        )

    valid = secrets.compare_digest(
        payload.username, settings.ADMIN_USER
    ) and secrets.compare_digest(payload.password, settings.ADMIN_PASSWORD)
    if not valid:
        count = await redis_client.incr(rate_key)
        if count == 1:
            await redis_client.expire(rate_key, RATE_WINDOW)
        raise HTTPException(
            status_code=401, detail="İstifadəçi adı və ya şifrə yanlışdır"
        )

    await redis_client.delete(rate_key)
    token = secrets.token_urlsafe(48)
    await redis_client.set(
        f"admin:session:{_hash(token)}", payload.username, ex=SESSION_TTL
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL,
        httponly=True,
        secure=(
            request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0]
            == "https"
            or settings.ENVIRONMENT == "production"
        ),
        samesite="strict",
        path="/",
    )
    return {
        "authenticated": True,
        "username": payload.username,
        "expires_in": SESSION_TTL,
    }


@router.get("/session")
async def session(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    username = (
        await redis_client.get(f"admin:session:{_hash(token)}") if token else None
    )
    if not username:
        raise HTTPException(status_code=401, detail="Sessiya mövcud deyil")
    ttl = await redis_client.ttl(f"admin:session:{_hash(token)}")
    return {"authenticated": True, "username": username, "expires_in": ttl}


@router.post("/logout")
async def logout(request: Request, response: Response):
    require_trusted_origin(request, get_settings().BACKEND_CORS_ORIGINS)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await redis_client.delete(f"admin:session:{_hash(token)}")
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="strict")
    return {"authenticated": False}
