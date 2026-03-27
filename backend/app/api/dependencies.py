import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.config import get_settings
from app.core.database import get_db

_security = HTTPBasic()


async def require_admin(
    credentials: HTTPBasicCredentials = Depends(_security),
) -> str:
    """Verify HTTP Basic Auth credentials for admin endpoints."""
    settings = get_settings()
    correct_user = secrets.compare_digest(credentials.username, settings.ADMIN_USER)
    correct_pass = secrets.compare_digest(credentials.password, settings.ADMIN_PASSWORD)
    if not (correct_user and correct_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


__all__ = ["get_db", "require_admin"]
