from typing import List


class YouTubeProvider:
    name = "youtube"

    async def fetch(self, filters: dict | None = None) -> List[dict]:
        filters = filters or {}
        items = filters.get("items") or []
        resources = [
            {
                "provider": self.name,
                "provider_resource_id": item.get("id") or item.get("url"),
                "title": item.get("title") or "YouTube learning resource",
                "description": item.get("description"),
                "source_url": item.get("url"),
                "resource_type": "video",
                "language": item.get("language") or filters.get("language", "en"),
                "level": item.get("level") or filters.get("level"),
                "free_or_paid": "free",
                "duration_hours": item.get("duration_hours"),
                "skill_tags": item.get("skill_tags") or filters.get("skill_tags") or [],
                "target_roles": item.get("target_roles") or filters.get("target_roles") or [],
                "content": item.get("content") or item.get("description") or item.get("title") or "",
                "metadata": {"source": "youtube"},
            }
            for item in items
            if item.get("url")
        ]

        for url in filters.get("urls") or []:
            resources.append(
                {
                    "provider": self.name,
                    "provider_resource_id": url,
                    "title": filters.get("title") or "YouTube learning resource",
                    "description": filters.get("description") or "Video learning resource imported from YouTube.",
                    "source_url": url,
                    "resource_type": "video",
                    "language": filters.get("language", "en"),
                    "level": filters.get("level"),
                    "free_or_paid": "free",
                    "duration_hours": filters.get("duration_hours"),
                    "skill_tags": filters.get("skill_tags") or [],
                    "target_roles": filters.get("target_roles") or [],
                    "content": filters.get("content") or filters.get("description") or "Video learning resource imported from YouTube.",
                    "metadata": {"source": "youtube"},
                }
            )

        return resources
