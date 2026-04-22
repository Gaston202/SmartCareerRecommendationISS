import hashlib
import re


def normalize_url(url: str) -> str:
    cleaned = url.strip().lower()
    cleaned = cleaned.split("#", 1)[0].split("?", 1)[0]
    cleaned = re.sub(r"/+$", "", cleaned)
    return cleaned


def sha256_text(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
