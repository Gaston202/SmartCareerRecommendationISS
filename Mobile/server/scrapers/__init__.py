"""
Job detail scrapers for various job boards.
"""
from .base import BaseScraper, JobSalary, JobDetails
from .registry import get_scraper_for_url, list_available_scrapers

__all__ = [
    'BaseScraper',
    'JobSalary',
    'JobDetails',
    'get_scraper_for_url',
    'list_available_scrapers',
]
