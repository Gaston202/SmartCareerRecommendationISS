from typing import List
from urllib.parse import urlparse

import httpx


class WebProvider:
    name = "web"

    async def fetch(self, filters: dict | None = None) -> List[dict]:
        filters = filters or {}
        urls = filters.get("urls") or []
        items = []

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for url in urls:
                from bs4 import BeautifulSoup

                response = await client.get(url)
                response.raise_for_status()
                final_url = str(response.url)
                provider = self._provider_from_url(final_url)
                soup = BeautifulSoup(response.text, "html.parser")
                title = soup.title.string.strip() if soup.title and soup.title.string else final_url
                text = " ".join(node.get_text(" ", strip=True) for node in soup.find_all(["p", "li", "h1", "h2", "h3"]))
                skill_context = " ".join((filters.get("skill_tags") or []) + (filters.get("target_roles") or []))
                content = f"{title} {skill_context} {text}".strip()
                items.append(
                    {
                        "provider": provider,
                        "provider_resource_id": final_url,
                        "title": title,
                        "description": text[:500],
                        "source_url": final_url,
                        "resource_type": filters.get("resource_type") or self._resource_type_from_url(final_url),
                        "language": filters.get("language", "en"),
                        "level": filters.get("level"),
                        "free_or_paid": filters.get("free_or_paid", "free"),
                        "skill_tags": filters.get("skill_tags") or [],
                        "target_roles": filters.get("target_roles") or [],
                        "content": content,
                        "metadata": {"source": "web", "requested_url": url},
                    }
                )

        return items

    def _provider_from_url(self, url: str) -> str:
        hostname = urlparse(url).netloc.lower()
        if "youtube.com" in hostname or "youtu.be" in hostname:
            return "youtube"
        if "google.com" in hostname or "cloud.google.com" in hostname or "developers.google.com" in hostname:
            return "google"
        if "coursera.org" in hostname:
            return "coursera"
        if "edx.org" in hostname:
            return "edx"
        if "freecodecamp.org" in hostname:
            return "freecodecamp"
        if "udemy.com" in hostname:
            return "udemy"
        if "microsoft.com" in hostname:
            return "microsoft"
        if "aws.amazon.com" in hostname or "skillbuilder.aws" in hostname:
            return "aws"
        return self.name

    def _resource_type_from_url(self, url: str) -> str:
        hostname = urlparse(url).netloc.lower()
        path = urlparse(url).path.lower()
        if "youtube.com" in hostname or "youtu.be" in hostname:
            return "video"
        if "coursera.org" in hostname or "edx.org" in hostname or "udemy.com" in hostname:
            return "course"
        if "certification" in path or "certificate" in path or "certifications" in path:
            return "certification"
        return "article"
