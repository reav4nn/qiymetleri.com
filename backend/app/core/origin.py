from collections.abc import Iterable
from urllib.parse import urlsplit

from fastapi import HTTPException, Request


def _canonical_origin(value: str) -> str | None:
    try:
        parsed = urlsplit(value.strip())
        port = parsed.port
    except ValueError:
        return None
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        return None
    hostname = parsed.hostname.lower()
    if ":" in hostname:
        hostname = f"[{hostname}]"
    default_port = (parsed.scheme == "http" and port == 80) or (
        parsed.scheme == "https" and port == 443
    )
    suffix = f":{port}" if port and not default_port else ""
    return f"{parsed.scheme}://{hostname}{suffix}"


def require_trusted_origin(request: Request, allowed_origins: Iterable[str]) -> None:
    origin = _canonical_origin(request.headers.get("origin", ""))
    scheme = (
        request.headers.get("x-forwarded-proto", request.url.scheme)
        .split(",", 1)[0]
        .strip()
    )
    forwarded_host = (
        request.headers.get("x-forwarded-host", "").split(",", 1)[0].strip()
    )
    host = forwarded_host or request.headers.get("host", "")
    trusted = {
        normalized
        for candidate in [f"{scheme}://{host}", *allowed_origins]
        if (normalized := _canonical_origin(candidate))
    }
    if origin is None or origin not in trusted:
        raise HTTPException(status_code=403, detail="Sorğunun mənbəyi etibarsızdır")
