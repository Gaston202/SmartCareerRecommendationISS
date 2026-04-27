"""
Indeed job scraper.
"""
import re
import json
from typing import Optional
from bs4 import BeautifulSoup
from httpx import AsyncClient, Timeout
from .base import BaseScraper, JobDetails, JobSalary
from .utils import SELECTORS, find_element, clean_description_html


class IndeedScraper(BaseScraper):
    """Scraper for Indeed job listings."""

    # Indeed URL patterns
    INDEED_PATTERNS = [
        r'indeed\.com/viewjob',
        r'indeed\.com/jobs',
        r'indeed\.com.*?/job',
    ]

    @staticmethod
    def can_handle(url: str) -> bool:
        """Check if URL is from Indeed."""
        url_lower = url.lower()
        return any(re.search(pattern, url_lower) for pattern in IndeedScraper.INDEED_PATTERNS)

    async def scrape_details(self, job_url: str, html_content: Optional[str] = None) -> JobDetails:
        """
        Scrape job details from Indeed job page.
        Uses improved headers and retry logic.
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

        # Try to extract from JSON-LD structured data first (more reliable, often less protected)
        description, salary = self.extract_from_json_ld(soup)

        # If no description from JSON-LD, fall back to HTML selectors
        if not description:
            desc_selectors = SELECTORS['indeed']['description']
            desc_element = find_element(soup, desc_selectors)
            if desc_element:
                description = clean_description_html(str(desc_element))

        # Extract salary from JSON-LD or HTML
        if not salary:
            salary_selectors = SELECTORS['indeed']['salary']
            salary_element = find_element(soup, salary_selectors)
            if salary_element:
                salary_text = self.clean_text(salary_element)
                salary = self.extract_salary(salary_text)

        # Extract skills from description
        skills = self.extract_skills(description or "")

        # Also try to find skills in "Skills" section if present
        if not skills:
            if soup:
                all_lists = soup.find_all(['ul', 'ol'])
                for list_elem in all_lists:
                    list_items = list_elem.find_all('li')
                    if 3 <= len(list_items) <= 15:
                        skills = [self.clean_text(item) for item in list_items if self.clean_text(item)]
                        if len(skills) >= 3:
                            break

        return JobDetails(
            salary=salary,
            description=description,
            skills=skills[:20],
        )

    def extract_from_json_ld(self, soup: BeautifulSoup) -> tuple[Optional[str], Optional[JobSalary]]:
        """
        Extract job data from JSON-LD structured data in the page.
        Indeed often includes schema.org JobPosting data.
        Returns: (description, salary)
        """
        try:
            # Find all script tags with type application/ld+json
            scripts = soup.find_all('script', {'type': 'application/ld+json'})
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    # Handle both single object and array
                    if isinstance(data, list):
                        for item in data:
                            if item.get('@type') == 'JobPosting':
                                return self.parse_job_posting(item)
                    elif data.get('@type') == 'JobPosting':
                        return self.parse_job_posting(data)
                except (json.JSONDecodeError, AttributeError, TypeError):
                    continue
        except Exception:
            pass
        return None, None

    def parse_job_posting(self, data: dict) -> tuple[Optional[str], Optional[JobSalary]]:
        """Parse JobPosting JSON-LD schema."""
        description = data.get('description')
        if description and isinstance(description, str):
            # Clean HTML if present
            description = clean_description_html(description)

        # Extract salary from baseSalary or salaryCurrency
        salary = None
        base_salary = data.get('baseSalary') or data.get('salary')
        if base_salary:
            if isinstance(base_salary, dict):
                min_val = base_salary.get('value', {}).get('minValue')
                max_val = base_salary.get('value', {}).get('maxValue')
                currency = base_salary.get('currency')
                unit_text = base_salary.get('unitText')

                if min_val or max_val:
                    salary = JobSalary(
                        min_amount=float(min_val) if min_val else None,
                        max_amount=float(max_val) if max_val else None,
                        currency=currency or 'USD',
                        interval=self.normalize_interval(unit_text) if unit_text else None
                    )
            elif isinstance(base_salary, str):
                # Parse salary string
                salary = self.extract_salary(base_salary)

        return description, salary

    def normalize_interval(self, interval_text: str) -> str:
        """Normalize salary interval text to standard values."""
        if not interval_text:
            return 'yearly'
        text = interval_text.lower()
        mapping = {
            'year': 'yearly', 'annual': 'yearly', 'annum': 'yearly',
            'month': 'monthly', 'mo': 'monthly',
            'week': 'weekly', 'wk': 'weekly',
            'day': 'daily',
            'hour': 'hourly', 'hr': 'hourly'
        }
        for key, val in mapping.items():
            if key in text:
                return val
        return 'yearly'
