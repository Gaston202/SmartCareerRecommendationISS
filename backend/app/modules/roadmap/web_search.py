import logging
import os
from typing import List

logger = logging.getLogger(__name__)


class RoadmapWebSearchService:
    def __init__(self):
        self.api_key = os.getenv("TAVILY_API_KEY", "").strip()
        self.client = None
        if self.api_key:
            try:
                from tavily import TavilyClient

                self.client = TavilyClient(api_key=self.api_key)
            except Exception as exc:
                logger.warning("Tavily SDK unavailable: %s", exc)

    async def fallback_search(self, skill: str) -> List[dict]:
        if not self.client:
            return []

        try:
            response = self.client.search(
                query=f"{skill} learning resource",
                search_depth="basic",
                max_results=3,
            )
            results = response.get("results") or []
            return [
                {
                    "title": item.get("title"),
                    "source_url": item.get("url"),
                    "provider": self._hostname(item.get("url") or ""),
                    "score": item.get("score") or 0.4,
                    "resource_type": "article",
                    "free_or_paid": "free",
                    "language": "en",
                }
                for item in results[:3]
                if item.get("title") and item.get("url")
            ]
        except Exception as exc:
            logger.warning("Tavily fallback failed for %s: %s", skill, exc)
            return []

    def _hostname(self, url: str) -> str:
        try:
            from urllib.parse import urlparse

            return urlparse(url).netloc or "web"
        except Exception:
            return "web"
