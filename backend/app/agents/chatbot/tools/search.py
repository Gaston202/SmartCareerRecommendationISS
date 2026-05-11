import logging
from typing import Optional
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


@tool
def web_search(query: str, max_results: int = 5) -> dict:
    """
    Search the web for information using DuckDuckGo.

    Args:
        query: The search query to look up
        max_results: Maximum number of results to return (default 5)

    Returns:
        Dictionary with search results and metadata
    """
    try:
        import os
        # Ensure UTF-8 encoding for the subprocess on Windows
        os.environ['PYTHONIOENCODING'] = 'utf-8'

        from duckduckgo_search import DDGS

        results = []
        with DDGS() as ddgs:
            for i, result in enumerate(ddgs.text(query, max_results=max_results)):
                if i >= max_results:
                    break
                try:
                    title = result.get("title", "") or ""
                    url = result.get("href", "") or ""
                    snippet = (result.get("body", "") or "")[:300]
                    # Skip results with encoding issues
                    if title or url or snippet:
                        results.append({
                            "title": title,
                            "url": url,
                            "snippet": snippet
                        })
                except Exception as e:
                    logger.debug(f"Skipping result due to encoding issue: {e}")
                    continue

        return {
            "success": True,
            "query": query,
            "results": results,
            "count": len(results)
        }
    except ImportError:
        return {
            "success": False,
            "query": query,
            "results": [],
            "error": "duckduckgo-search not installed. Run: pip install duckduckgo-search"
        }
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return {
            "success": False,
            "query": query,
            "results": [],
            "error": str(e)
        }


@tool
def search_career_info(career_name: str) -> dict:
    """
    Search for detailed information about a specific career path.

    Args:
        career_name: Name of the career (e.g., 'data scientist', 'frontend developer')

    Returns:
        Dictionary with career information, salary range, and demand data
    """
    query = f"{career_name} career outlook 2026 salary requirements skills"
    return web_search.invoke(query)


@tool
def get_job_trends(topic: str, max_results: int = 5) -> dict:
    """
    Get current job market trends for a specific topic or technology.

    Args:
        topic: Technology or topic to search (e.g., 'AI jobs', 'cloud computing', 'JavaScript')
        max_results: Maximum number of results to return

    Returns:
        Dictionary with job trend information
    """
    query = f"most in-demand {topic} jobs 2026 market trends salary"
    return web_search.invoke({"query": query, "max_results": max_results})


@tool
def get_career_recommendations_info(user_id: str) -> dict:
    """
    Get AI-generated career recommendations for a user.
    Uses the existing career service to fetch recommendations.

    Args:
        user_id: UUID of the user

    Returns:
        Dictionary with career recommendations
    """
    try:
        from app.modules.career.service import CareerService

        async def _get():
            career_service = CareerService()
            recommendations = await career_service.get_career_recommendations(user_id)
            return recommendations

        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(_get())
    except Exception as e:
        return {
            "success": False,
            "error": f"Could not fetch career recommendations: {str(e)}",
            "recommendations": []
        }


@tool
def explain_career(career_name: str) -> dict:
    """
    Get a comprehensive explanation of a career path including:
    - What the role entails
    - Required skills
    - Salary expectations
    - Career progression

    Args:
        career_name: Name of the career to explain

    Returns:
        Dictionary with comprehensive career information
    """
    query = f"{career_name} career guide responsibilities required skills salary 2026 progression"

    try:
        from duckduckgo_search import DDGS

        results = []
        with DDGS() as ddgs:
            for i, result in enumerate(ddgs.text(query, max_results=5)):
                if i >= 5:
                    break
                try:
                    title = result.get("title", "") or ""
                    url = result.get("href", "") or ""
                    snippet = (result.get("body", "") or "")[:200]
                    if title or url or snippet:
                        results.append({
                            "title": title,
                            "url": url,
                            "snippet": snippet
                        })
                except Exception:
                    continue

        return {
            "success": True,
            "career": career_name,
            "information": results,
            "summary": f"Here's what I found about {career_name} careers in 2026"
        }
    except Exception as e:
        return {
            "success": False,
            "career": career_name,
            "error": str(e)
        }