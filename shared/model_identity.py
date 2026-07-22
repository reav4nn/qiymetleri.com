"""Pure helpers for stable canonical model identity."""

from __future__ import annotations

import re
import unicodedata

_AZ_TRANSLATION = str.maketrans(
    {"ə": "e", "ı": "i", "ş": "s", "ç": "c", "ö": "o", "ü": "u", "ğ": "g"}
)


def model_slug(brand: str, name: str) -> str:
    raw = f"{brand} {name}".lower().translate(_AZ_TRANSLATION)
    ascii_name = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    return (re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-") or "model")[:320]
