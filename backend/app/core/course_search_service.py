import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class CourseSearchService:
    """Web search service for finding online courses using DuckDuckGo."""

    def __init__(self, max_results: int = 3):
        self.max_results = max_results

    def search_courses(self, skill_name: str, difficulty: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for courses related to a skill via DuckDuckGo web search."""
        query = self._build_query(skill_name, difficulty)
        try:
            from duckduckgo_search import DDGS

            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=self.max_results))
            return [self._parse_result(r) for r in results]
        except ImportError:
            logger.warning("duckduckgo-search not installed. Run: pip install duckduckgo-search")
            return []
        except Exception as e:
            logger.warning(f"Course search failed for '{skill_name}': {e}")
            return []

    def _build_query(self, skill_name: str, difficulty: Optional[str] = None) -> str:
        base = f"best {skill_name} online course"
        if difficulty:
            base += f" {difficulty}"
        base += " site:coursera.org OR site:udemy.com OR site:edx.org OR site:freecodecamp.org OR site:pluralsight.com"
        return base

    def _parse_result(self, result: Dict) -> Dict[str, Any]:
        return {
            "title": result.get("title", ""),
            "url": result.get("href", ""),
            "snippet": result.get("body", ""),
            "provider": self._extract_provider(result.get("href", "")),
        }

    def _extract_provider(self, url: str) -> str:
        if not url:
            return "Online Course"
        if "coursera" in url:
            return "Coursera"
        if "udemy" in url:
            return "Udemy"
        if "edx" in url:
            return "edX"
        if "freecodecamp" in url:
            return "freeCodeCamp"
        if "pluralsight" in url:
            return "Pluralsight"
        if "linkedin.com/learning" in url:
            return "LinkedIn Learning"
        if "youtube" in url:
            return "YouTube"
        return "Online Course"


def get_course_search_service() -> CourseSearchService:
    max_results = int(os.getenv("COURSE_SEARCH_LIMIT", "3"))
    return CourseSearchService(max_results=max_results)
