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
        query = self._build_course_query(skill_name, difficulty)
        logger.info("[CourseSearch] query=%s", query)
        results = self._execute(query)
        logger.info("[CourseSearch] skill='%s' returned=%s results", skill_name, len(results))
        return results

    def search_certifications(self, skill_name: str) -> List[Dict[str, Any]]:
        """Search for certifications related to a skill."""
        query = self._build_cert_query(skill_name)
        logger.info("[CertSearch] query=%s", query)
        results = self._execute(query)
        logger.info("[CertSearch] skill='%s' returned=%s results", skill_name, len(results))
        return results

    def _execute(self, query: str) -> List[Dict[str, Any]]:
        try:
            from ddgs import DDGS

            with DDGS() as ddgs:
                raw = list(ddgs.text(query, max_results=self.max_results))
            parsed = [self._parse_result(r) for r in raw]
            # Filter out entries with no URL or no title
            return [p for p in parsed if p.get("url") and p.get("title")]
        except ImportError:
            logger.warning("ddgs not installed. Run: pip install ddgs")
            return []
        except Exception as e:
            logger.warning("DDGS search failed: %s", e)
            return []

    def _build_course_query(self, skill_name: str, difficulty: Optional[str] = None) -> str:
        """Build a concise DDGS query."""
        q = skill_name.strip()
        if not any(w in q.lower() for w in ["course", "class", "training", "tutorial"]):
            q += " course"
        if difficulty and difficulty.lower() in {"beginner", "intermediate", "advanced"}:
            q += f" {difficulty}"
        return q

    def _build_cert_query(self, skill_name: str) -> str:
        """Build a concise DDGS query for certifications."""
        q = skill_name.strip()
        if "certification" not in q.lower():
            q += " certification"
        return q

    def _parse_result(self, result: Dict) -> Dict[str, Any]:
        return {
            "title": result.get("title", ""),
            "url": result.get("href", ""),
            "snippet": result.get("body", ""),
            "provider": self._extract_provider(result.get("href", "")),
            "score": 0.5,
        }

    def _extract_provider(self, url: str) -> str:
        if not url:
            return "Online Course"
        domain_map = {
            "coursera": "Coursera",
            "udemy": "Udemy",
            "edx": "edX",
            "freecodecamp": "freeCodeCamp",
            "pluralsight": "Pluralsight",
            "linkedin.com/learning": "LinkedIn Learning",
            "linkedin": "LinkedIn",
            "datacamp": "DataCamp",
            "codecademy": "Codecademy",
            "khanacademy": "Khan Academy",
            "udacity": "Udacity",
            "skillshare": "Skillshare",
            "futurelearn": "FutureLearn",
            "alison": "Alison",
            "google": "Google",
            "microsoft": "Microsoft",
            "aws": "AWS",
            "oracle": "Oracle",
            "youtube": "YouTube",
        }
        url_lower = url.lower()
        for key, label in domain_map.items():
            if key in url_lower:
                return label
        return "Online Course"


def get_course_search_service() -> CourseSearchService:
    max_results = int(os.getenv("COURSE_SEARCH_LIMIT", "3"))
    return CourseSearchService(max_results=max_results)
