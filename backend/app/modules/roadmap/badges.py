from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse


OFFICIAL_HOST_ALIASES = {
    "celery": ("celeryq.dev", "celeryproject.org"),
    "docker": ("docker.com",),
    "fastapi": ("fastapi.tiangolo.com",),
    "git": ("git-scm.com",),
    "postgresql": ("postgresql.org",),
    "redis": ("redis.io",),
}


@dataclass(frozen=True)
class ResourcePresentation:
    display_badges: list[str]
    recommendation_reason: Optional[str]


def build_resource_presentation(skill: str, resource: dict[str, Any]) -> ResourcePresentation:
    badges = _display_badges(skill, resource)
    reason = _recommendation_reason(skill, resource, badges)
    return ResourcePresentation(display_badges=badges or [], recommendation_reason=reason)


def _display_badges(skill: str, resource: dict[str, Any]) -> list[str]:
    badges: list[str] = []
    resource_type = _normalize(resource.get("resource_type"))
    free_or_paid = _normalize(resource.get("free_or_paid"))
    level = _normalize(resource.get("level"))
    score = float(resource.get("score") or resource.get("final_score") or 0)

    if _is_official_resource(skill, resource):
        badges.append("Official")
    if free_or_paid == "free":
        badges.append("Free")
    if resource_type == "certification":
        badges.append("Certification")
    if resource_type == "video":
        badges.append("Video")
    if resource_type in {"docs", "documentation"}:
        badges.append("Docs")
    if level == "beginner":
        badges.append("Beginner friendly")
    elif level == "intermediate":
        badges.append("Intermediate")
    elif level == "advanced":
        badges.append("Advanced")
    if score >= 0.75:
        badges.append("Highly relevant")

    return badges


def _recommendation_reason(skill: str, resource: dict[str, Any], badges: list[str]) -> Optional[str]:
    title = str(resource.get("title") or "").strip()
    provider = _provider_label(resource)
    skill_label = skill.replace("_", " ")
    resource_type = _normalize(resource.get("resource_type"))
    level = _normalize(resource.get("level"))

    if "Official" in badges and resource_type in {"docs", "documentation"}:
        return f"Official {skill_label.title()} documentation selected for the {skill_label} skill."

    if "Official" in badges:
        return f"Official {skill_label.title()} resource selected for the {skill_label} skill."

    if "Free" in badges and level == "beginner" and provider:
        type_label = "course" if resource_type in {"course", "tutorial", "video"} else "resource"
        return f"Free beginner {type_label} from {provider} selected for the {skill_label} skill."

    if "Certification" in badges and provider:
        return f"Certification resource from {provider} selected for the {skill_label} skill."

    if "Video" in badges and provider:
        return f"Video resource from {provider} selected for the {skill_label} skill."

    if "Highly relevant" in badges:
        return f"Top-ranked resource for {skill_label} with strong evidence."

    if title and provider:
        return f"{title} from {provider} selected for the {skill_label} skill."

    if title:
        return f"{title} selected for the {skill_label} skill."

    return None


def _is_official_resource(skill: str, resource: dict[str, Any]) -> bool:
    skill_key = _normalize(skill)
    provider = _normalize(resource.get("provider"))
    host = _normalize(urlparse(str(resource.get("source_url") or "")).netloc)
    title = _normalize(resource.get("title"))
    aliases = OFFICIAL_HOST_ALIASES.get(skill_key, ())

    if any(alias in host for alias in aliases):
        return True

    return bool(skill_key and (skill_key == provider or skill_key in host or skill_key in title))


def _provider_label(resource: dict[str, Any]) -> Optional[str]:
    provider = str(resource.get("provider") or "").strip()
    if provider:
        return provider.replace("_", " ").title()
    source_url = str(resource.get("source_url") or "")
    host = urlparse(source_url).netloc.replace("www.", "")
    return host or None


def _normalize(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "_")
