"""
LinkedIn job scraper.
"""
import os
import re
import json
from typing import Optional
from bs4 import BeautifulSoup
from httpx import AsyncClient, Timeout
from .base import BaseScraper, JobDetails, JobSalary
from .utils import SELECTORS, find_element, clean_description_html
from .llm_extractor import LLMExtractor, extract_with_llm


class LinkedInScraper(BaseScraper):
    """Scraper for LinkedIn job listings."""

    LINKEDIN_PATTERNS = [
        r'linkedin\.com/jobs/',
        r'linkedin\.com/job/',
    ]

    @staticmethod
    def can_handle(url: str) -> bool:
        """Check if URL is from LinkedIn."""
        url_lower = url.lower()
        return any(re.search(pattern, url_lower) for pattern in LinkedInScraper.LINKEDIN_PATTERNS)

    async def scrape_details(self, job_url: str, html_content: Optional[str] = None) -> JobDetails:
        """
        Scrape job details from LinkedIn job page.
        Uses improved headers and retry logic to bypass bot detection.
        """
        soup = None
        html = None

        if html_content:
            html = html_content
            soup = BeautifulSoup(html, 'lxml')
        else:
            timeout = Timeout(10.0, connect=5.0)
            async with AsyncClient(timeout=timeout, follow_redirects=True) as client:
                html = await self.fetch_with_retry(client, job_url)
                if not html:
                    return JobDetails(description="Failed to fetch job page after retries")
                soup = BeautifulSoup(html, 'lxml')

        if not soup or not html:
            return JobDetails()

        # Strategy 1: Try LLM extraction if OPENROUTER_API_KEY is set
        # This is the most robust approach (similar to your n8n workflow)
        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        if openrouter_key:
            try:
                print("DEBUG: Using LLM extraction for LinkedIn job")
                llm_result = await extract_with_llm(html, api_key=openrouter_key)

                # Extract fields from LLM result
                description = llm_result.get("description", "").strip()
                salary_str = llm_result.get("salary", "").strip()
                skills = llm_result.get("skills", [])

                # Parse salary string to JobSalary
                salary = None
                if salary_str:
                    salary = self.extract_salary(salary_str)

                if description or skills:
                    print(f"DEBUG: LLM extraction success - desc_len={len(description)}, skills_count={len(skills)}")
                    return JobDetails(
                        salary=salary,
                        description=description,
                        skills=skills,
                    )
                else:
                    print("WARNING: LLM returned empty description and skills, falling back")
            except Exception as e:
                print(f"WARNING: LLM extraction failed: {e}, falling back to traditional methods")

        # Strategy 2: Try JSON-LD structured data (fast, no API cost)
        description, salary = self.extract_from_json_ld(soup)
        if description and len(description) > 50:  # Consider valid if reasonably long
            print("DEBUG: Using JSON-LD extraction")
            # Extract skills from description if available
            if description:
                skills = self.extract_skills(description)
                # Also try to find dedicated skills section
                page_text = soup.get_text(separator='\n', strip=True)
                lines = page_text.split('\n')
                for i, line in enumerate(lines):
                    if re.search(r'skills:|technologies:|languages:', line.lower()):
                        for j in range(i + 1, min(i + 10, len(lines))):
                            skill = lines[j].strip().rstrip('.,;:')
                            if 2 < len(skill) < 50 and skill not in skills:
                                skills.append(skill)
                skills = list(set(skills))[:20]
            else:
                skills = []

            return JobDetails(
                salary=salary,
                description=description,
                skills=skills,
            )

        # Strategy 3: Fallback to HTML selectors
        print("DEBUG: Falling back to HTML selectors")
        description = None
        desc_selectors = SELECTORS['linkedin']['description']
        desc_element = find_element(soup, desc_selectors)
        if desc_element:
            description = clean_description_html(str(desc_element))
        else:
            # Fallback: Look for any div with class containing 'description'
            fallback = soup.find('div', {'class': re.compile(r'description', re.I)})
            if fallback:
                description = clean_description_html(str(fallback))

        # Extract salary if not from JSON-LD
        if not salary:
            salary_selectors = SELECTORS['linkedin']['salary']
            salary_element = find_element(soup, salary_selectors)
            if salary_element:
                salary_text = self.clean_text(salary_element)
                salary = self.extract_salary(salary_text)

        # Extract skills
        skills = []
        if description:
            skills = self.extract_skills(description)

        # Try to find dedicated skills section
        if soup:
            page_text = soup.get_text(separator='\n', strip=True)
            lines = page_text.split('\n')
            for i, line in enumerate(lines):
                if re.search(r'skills:|technologies:|languages:', line.lower()):
                    for j in range(i + 1, min(i + 10, len(lines))):
                        skill = lines[j].strip().rstrip('.,;:')
                        if 2 < len(skill) < 50 and skill not in skills:
                            skills.append(skill)

        return JobDetails(
            salary=salary,
            description=description,
            skills=list(set(skills))[:20],
        )

    def extract_from_json_ld(self, soup: BeautifulSoup) -> tuple[Optional[str], Optional[JobSalary]]:
        """Extract job data from JSON-LD structured data."""
        try:
            scripts = soup.find_all('script', {'type': 'application/ld+json'})
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    if isinstance(data, list):
                        for item in data:
                            if item.get('@type') in ['JobPosting', 'JobPosting']:
                                return self.parse_job_posting(item)
                    elif data.get('@type') in ['JobPosting', 'JobPosting']:
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
            description = clean_description_html(description)

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
