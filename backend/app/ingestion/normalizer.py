from urllib.parse import urlsplit, urlunsplit

from app.modules.roadmap.schemas import ResourceSchema


def normalize_resource(raw: dict) -> ResourceSchema:
    source_url = raw.get("source_url") or raw.get("url") or ""
    return ResourceSchema(
        provider=raw.get("provider") or "web",
        provider_resource_id=raw.get("provider_resource_id") or source_url,
        title=(raw.get("title") or "Untitled resource").strip(),
        description=raw.get("description"),
        source_url=source_url,
        resource_type=raw.get("resource_type") or "article",
        language=raw.get("language") or "en",
        level=raw.get("level"),
        free_or_paid=raw.get("free_or_paid") or "free",
        duration_hours=raw.get("duration_hours"),
        certificate=bool(raw.get("certificate", False)),
        skill_tags=list(dict.fromkeys(raw.get("skill_tags") or [])),
        target_roles=list(dict.fromkeys(raw.get("target_roles") or [])),
        content=raw.get("content") or raw.get("description") or raw.get("title") or "",
        metadata=raw.get("metadata") or {},
    )


def normalize_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), "", ""))
