from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
import re
import asyncio
import random
from httpx import AsyncClient
import os


@dataclass
class JobSalary:
    """Represents a salary range with optional currency and interval."""
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    currency: str = "USD"
    interval: Optional[str] = None  # yearly, monthly, weekly, daily, hourly

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class JobDetails:
    """Enriched job details from scraping the job page."""
    salary: Optional[JobSalary] = None
    description: Optional[str] = None
    skills: List[str] = None
    raw_html: Optional[str] = None  # For debugging

    def __post_init__(self):
        if self.skills is None:
            self.skills = []

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        if self.salary:
            result['salary'] = self.salary.to_dict()
        if self.description is not None:
            result['description'] = self.description
        if self.skills:
            result['skills'] = self.skills
        return result


class BaseScraper(ABC):
    """Abstract base class for job site scrapers."""

    # Common browser-like headers to appear more human
    DEFAULT_HEADERS = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    }

    # Multiple user agents to rotate
    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    ]

    @staticmethod
    @abstractmethod
    def can_handle(url: str) -> bool:
        """Check if this scraper can handle the given job URL."""
        pass

    @abstractmethod
    async def scrape_details(self, job_url: str, html_content: Optional[str] = None) -> JobDetails:
        """
        Scrape job details from the job page.
        Args:
            job_url: URL of the job posting
            html_content: Optional pre-fetched HTML (to avoid fetching twice)
        Returns:
            JobDetails object with salary, description, skills
        """
        pass

    def get_random_headers(self, referer: Optional[str] = None) -> Dict[str, str]:
        """Generate random headers with rotating user agent and optional referer."""
        headers = self.DEFAULT_HEADERS.copy()
        headers['User-Agent'] = random.choice(self.USER_AGENTS)
        if referer:
            headers['Referer'] = referer
        return headers

    def get_scraper_api_url(self, target_url: str) -> str:
        """
        Build ScraperAPI URL if SCRAPER_API_KEY is set.
        Returns the original URL if no API key is configured.
        """
        scraper_api_key = os.getenv("SCRAPER_API_KEY")
        if scraper_api_key:
            # Use ScraperAPI to bypass bot detection
            # Correct endpoint: api.scraperapi.com
            scraper_url = f"https://api.scraperapi.com/?api_key={scraper_api_key}&url={target_url}"
            print(f"DEBUG: Using ScraperAPI for {target_url[:50]}...")
            return scraper_url
        return target_url

    async def fetch_with_retry(self, client: AsyncClient, url: str, max_retries: int = 2, base_delay: float = 1.0) -> Optional[str]:
        """
        Fetch URL with retry logic, rotating user agents, and delays.
        Uses ScraperAPI if SCRAPER_API_KEY is set to bypass bot detection.
        Returns HTML string or None if all retries fail.
        """
        # Wrap URL with ScraperAPI if key is available
        fetch_url = self.get_scraper_api_url(url)

        for attempt in range(max_retries + 1):
            try:
                # Add delay between retries (exponential backoff)
                if attempt > 0:
                    delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, 1)
                    await asyncio.sleep(delay)

                headers = self.get_random_headers(referer=url)
                response = await client.get(fetch_url, headers=headers)

                # LinkedIn 999 or 429/403 = rate limited/bot detected
                if response.status_code in [999, 429, 403, 401]:
                    print(f"WARNING: Got {response.status_code} from {fetch_url}, retrying...")
                    continue

                if response.status_code == 200:
                    return response.text
                else:
                    print(f"WARNING: HTTP {response.status_code} from {fetch_url}")

            except Exception as e:
                print(f"ERROR fetching {fetch_url}: {e}")
                if attempt < max_retries:
                    continue

        return None

    def extract_salary(self, text: str) -> Optional[JobSalary]:
        """
        Parse salary information from text.
        Handles formats like:
        - "$120,000 - $150,000 a year"
        - "$120k - $150k yearly"
        - "$60 - $80 per hour"
        """
        if not text:
            return None

        # Clean the text
        text = text.strip().lower()

        # Pattern: $X - $Y [interval]
        pattern = r'\$?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|th)?\s*[-–to]+\s*\$?\s*(\d+(?:\.\d+)?)\s*(k|thousand|th)?\s*(per\s+)?(year|yr|month|mo|week|wk|day|hour|hr|annum|annual)?'
        match = re.search(pattern, text, re.IGNORECASE)

        if match:
            min_val = float(match.group(1))
            max_val = float(match.group(2))
            multiplier = 1000 if match.group(3) and ('k' in match.group(3).lower() or 'thousand' in match.group(3).lower()) else 1
            interval = match.group(5) if match.group(5) else None

            # Normalize intervals
            interval_map = {
                'year': 'yearly', 'yr': 'yearly', 'annum': 'yearly', 'annual': 'yearly',
                'month': 'monthly', 'mo': 'monthly',
                'week': 'weekly', 'wk': 'weekly',
                'day': 'daily',
                'hour': 'hourly', 'hr': 'hourly'
            }
            if interval:
                interval = interval_map.get(interval.lower(), 'yearly')
            else:
                interval = 'yearly'  # Default

            return JobSalary(
                min_amount=min_val * multiplier,
                max_amount=max_val * multiplier,
                currency="USD",
                interval=interval
            )

        # Single amount (e.g., "$120,000+")
        single_pattern = r'\$?\s*(\d+(?:\.\d+)?)\s*(k|thousand|th)?\s*(per\s+)?(year|yr|month|mo|week|wk|day|hour|hr)?'
        match = re.search(single_pattern, text, re.IGNORECASE)
        if match:
            min_val = float(match.group(1))
            multiplier = 1000 if match.group(2) and ('k' in match.group(2).lower() or 'thousand' in match.group(2).lower()) else 1
            interval = match.group(4) if match.group(4) else None

            interval_map = {
                'year': 'yearly', 'yr': 'yearly', 'annum': 'yearly', 'annual': 'yearly',
                'month': 'monthly', 'mo': 'monthly',
                'week': 'weekly', 'wk': 'weekly',
                'day': 'daily',
                'hour': 'hourly', 'hr': 'hourly'
            }
            if interval:
                interval = interval_map.get(interval.lower(), 'yearly')
            else:
                interval = 'yearly'

            return JobSalary(
                min_amount=min_val * multiplier,
                max_amount=None,
                currency="USD",
                interval=interval
            )

        return None

    def clean_text(self, html_element) -> str:
        """Extract and clean text from a BeautifulSoup element."""
        if not html_element:
            return ""
        # Remove extra whitespace, newlines
        text = html_element.get_text(separator=' ', strip=True)
        text = ' '.join(text.split())
        return text

    def extract_skills(self, text: str) -> List[str]:
        """
        Extract skills from text using simple pattern matching.
        This is a basic implementation - can be enhanced with NLP.
        """
        skills = []
        # Look for common skill section patterns
        skill_keywords = [
            'skills:', 'required skills:', 'qualifications:', 'requirements:',
            'technical skills:', 'you should have:', 'must have:', 'nice to have:'
        ]

        lines = text.split('\n')
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            if any(keyword in line_lower for keyword in skill_keywords):
                # Extract bullet points or comma-separated list after this line
                for j in range(i + 1, min(i + 20, len(lines))):
                    bullet = lines[j].strip().lstrip('•-*→✓›»').strip()
                    if bullet and len(bullet) < 100:  # Reasonable skill length
                        skills.append(bullet)
                # Also try to get skills from the same line after colon
                if ':' in line:
                    rest = line.split(':', 1)[1].strip()
                    if rest:
                        skills.extend([s.strip() for s in rest.split(',') if s.strip()])

        # Remove duplicates and clean
        unique_skills = []
        for skill in skills:
            skill = skill.strip(' .,;')
            if skill and skill not in unique_skills:
                unique_skills.append(skill)

        return unique_skills[:20]  # Limit to 20 skills
