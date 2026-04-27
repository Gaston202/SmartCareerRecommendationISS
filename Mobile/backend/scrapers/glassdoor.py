"""
Glassdoor job scraper.
"""
import re
from typing import Optional
from bs4 import BeautifulSoup
from httpx import AsyncClient, Timeout
from .base import BaseScraper, JobDetails, JobSalary
from .utils import SELECTORS, find_element, clean_description_html


class GlassdoorScraper(BaseScraper):
    """Scraper for Glassdoor job listings."""

    GLASSDOOR_PATTERNS = [
        r'glassdoor\.com/job-listing',
        r'glassdoor\.com/jobs/',
    ]

    @staticmethod
    def can_handle(url: str) -> bool:
        """Check if URL is from Glassdoor."""
        url_lower = url.lower()
        return any(re.search(pattern, url_lower) for pattern in GlassdoorScraper.GLASSDOOR_PATTERNS)

    async def scrape_details(self, job_url: str, html_content: Optional[str] = None) -> JobDetails:
        """
        Scrape job details from Glassdoor job page.
        """
        soup = None

        if html_content:
            soup = BeautifulSoup(html_content, 'lxml')
        else:
            timeout = Timeout(10.0, connect=5.0)
            async with AsyncClient(timeout=timeout, follow_redirects=True) as client:
                html = await self.fetch_with_retry(client, job_url)
                if not html:
                    return JobDetails(description="Failed to fetch job page after retries")
                soup = BeautifulSoup(html, 'lxml')

        if not soup:
            return JobDetails()

        # Extract description
        description = None
        desc_selectors = SELECTORS['glassdoor']['description']
        desc_element = find_element(soup, desc_selectors)
        if desc_element:
            description = clean_description_html(str(desc_element))
        else:
            # Glassdoor often uses data-testid
            fallback = soup.find('[data-testid="jobDescription"]')
            if fallback:
                description = clean_description_html(str(fallback))

        # Extract salary
        salary = None
        salary_selectors = SELECTORS['glassdoor']['salary']
        salary_element = find_element(soup, salary_selectors)
        if salary_element:
            salary_text = self.clean_text(salary_element)
            salary = self.extract_salary(salary_text)

        # Extract skills from description
        skills = []
        if description:
            skills = self.extract_skills(description)

        return JobDetails(
            salary=salary,
            description=description,
            skills=list(set(skills))[:20],
        )
