import hashlib
import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.cache import redis_client
from app.core.config import get_settings
from app.core.database import get_db

SESSION_COOKIE = "qiymetleri_admin_session"
_security = HTTPBasic(auto_error=False)


async def require_admin(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(_security),
) -> str:
    settings = get_settings()
    username: str | None = None
    if credentials:
        valid = secrets.compare_digest(
            credentials.username, settings.ADMIN_USER
        ) and secrets.compare_digest(credentials.password, settings.ADMIN_PASSWORD)
        if valid:
            username = credentials.username
    if username is None:
        token = request.cookies.get(SESSION_COOKIE)
        if token:
            username = await redis_client.get(
                f"admin:session:{hashlib.sha256(token.encode()).hexdigest()}"
            )
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Giriş tələb olunur"
        )
    if request.method in {"POST", "PATCH", "PUT", "DELETE"} and not credentials:
        origin = request.headers.get("origin")
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme).split(
            ","
        )[0]
        expected = f"{scheme}://{request.headers.get('host')}"
        if not origin or origin.rstrip("/") != expected.rstrip("/"):
            raise HTTPException(status_code=403, detail="Sorğunun mənbəyi etibarsızdır")
    return username


__all__ = ["get_db", "require_admin", "SESSION_COOKIE"]
