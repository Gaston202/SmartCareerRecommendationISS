"""
Scraper registry - manages available scrapers and routing.
"""
from typing import List, Optional, Type
from .base import BaseScraper
from . import indeed, linkedin, glassdoor  # Import all scrapers

# Registry of scrapers (will be populated on import)
SCRAPERS: List[Type[BaseScraper]] = [
    indeed.IndeedScraper,
    linkedin.LinkedInScraper,
    glassdoor.GlassdoorScraper,
]


def get_scraper_for_url(url: str) -> Optional[Type[BaseScraper]]:
    """
    Find the appropriate scraper for a given job URL.
    Returns the scraper class or None if no matching scraper found.
    """
    for scraper_class in SCRAPERS:
        if scraper_class.can_handle(url):
            return scraper_class
    return None


def list_available_scrapers() -> List[str]:
    """Return list of supported job sites."""
    return [scraper_class.__name__.replace('Scraper', '') for scraper_class in SCRAPERS]
