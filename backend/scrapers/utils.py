"""
Shared utilities and CSS selectors for job scrapers.
"""
from typing import Optional, List
import re


# CSS selectors for common job page elements (may need updates as sites change)
SELECTORS = {
    'indeed': {
        'description': [
            '#jobDescriptionText',
            '.jobsearch-jobDescriptionText',
            '[data-testid="jobDescriptionText"]',
        ],
        'salary': [
            '[data-testid="attribute_salary"]',
            '.jobsearch-JobInfoHeader-salary',
            '.salary-snippet-container',
            '.jobsearch-JobInfoHeader-itemSnippet',
        ],
        'skills': [
            # Indeed doesn't typically list skills explicitly
        ],
    },
    'linkedin': {
        'description': [
            '[data-testid="jobDescriptionText"]',
            '.description__job-description',
            '.jobs-description-content__text',
        ],
        'salary': [
            '.jobs-details-jobs-unified-top-card__primary-money',
            '.jobs-unified-top-card__salary-details',
            '[data-testid="salary"]',
        ],
        'skills': [
            # LinkedIn skills are often in separate section on other pages
        ],
    },
    'glassdoor': {
        'description': [
            '[data-testid="jobDescription"]',
            '.jobDescriptionContent',
            '.gd-job-spec',
        ],
        'salary': [
            '[data-testid="salary"]',
            '.salaryEstimate',
            '.estimated-salary',
        ],
        'skills': [
            # Glassdoor may list requirements in description
        ],
    },
}


def get_site_name_from_url(url: str) -> str:
    """
    Extract job site name from URL.
    Returns lowercase site name (indeed, linkedin, glassdoor, etc.)
    """
    url_lower = url.lower()

    if 'indeed.com' in url_lower or 'indeed.' in url_lower:
        return 'indeed'
    elif 'linkedin.com' in url_lower:
        return 'linkedin'
    elif 'glassdoor.com' in url_lower:
        return 'glassdoor'
    elif 'ziprecruiter.com' in url_lower:
        return 'ziprecruiter'
    elif 'google.com/jobs' in url_lower:
        return 'google_jobs'
    elif 'bayt.com' in url_lower:
        return 'bayt'
    elif 'naukri.com' in url_lower:
        return 'naukri'
    else:
        return 'unknown'


def find_element(soup, selectors: List[str]):
    """
    Try multiple CSS selectors in order and return first match.
    Returns None if no matches.
    """
    for selector in selectors:
        try:
            element = soup.select_one(selector)
            if element:
                return element
        except Exception:
            continue
    return None


def clean_description_html(html_content: str, max_length: int = 10000) -> str:
    """
    Clean and truncate HTML description.
    - Remove script, style tags
    - Convert to plain text while preserving some structure
    - Truncate if too long
    """
    if not html_content:
        return ""

    # If it's already text (no HTML tags), just clean whitespace
    if '<' not in html_content:
        text = ' '.join(html_content.split())
        return text[:max_length] if len(text) > max_length else text

    # Parse HTML with BeautifulSoup to extract clean text
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'lxml')

        # Remove script and style elements
        for tag in soup(['script', 'style']):
            tag.decompose()

        # Get text with some structure preservation
        # Use separator to keep paragraphs/lines somewhat distinct
        text = soup.get_text(separator='\n', strip=True)

        # Clean up whitespace
        lines = [line.strip() for line in text.split('\n')]
        lines = [line for line in lines if line]  # Remove empty lines
        text = '\n'.join(lines)

        # Truncate if too long (try to break at sentence boundary)
        if len(text) > max_length:
            # Find last sentence boundary before max_length
            truncated = text[:max_length]
            last_period = truncated.rfind('. ')
            if last_period > max_length * 0.5:  # If we found a decent break point
                text = truncated[:last_period + 1]
            else:
                text = truncated

        return text
    except Exception as e:
        # If BeautifulSoup fails, fallback to simple tag stripping
        import re
        text = re.sub(r'<[^>]+>', ' ', html_content)
        text = ' '.join(text.split())
        return text[:max_length]


def normalize_currency(currency: str) -> str:
    """Normalize currency codes to standard format."""
    currency_map = {
        'usd': 'USD',
        '$': 'USD',
        'us dollar': 'USD',
        'us dollars': 'USD',
        'eur': 'EUR',
        '€': 'EUR',
        'euro': 'EUR',
        'euros': 'EUR',
        'gbp': 'GBP',
        '£': 'GBP',
        'pound': 'GBP',
        'pounds': 'GBP',
    }
    return currency_map.get(currency.lower().strip(), 'USD')
