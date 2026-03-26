from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jobspy import scrape_jobs
from typing import List, Optional, Dict, Any
import asyncio
import json
import math
import pandas as pd
import numpy as np
import time
import random
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load .env file if it exists
load_dotenv()

# Scraping imports
from bs4 import BeautifulSoup
from httpx import AsyncClient, Timeout

# Scraper module
from scrapers import get_scraper_for_url, JobDetails as ScraperJobDetails

app = FastAPI(title="Job Spy API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Job boards supported by JobSpy
ALLOWED_SITES = ["indeed", "linkedin", "zip_recruiter", "glassdoor", "google", "bayt", "naukri"]
# Default sites (most reliable): Indeed and LinkedIn only
DEFAULT_SITES = ["indeed", "linkedin"]

# Job type mapping (JobSpy expects these exact values)
JOB_TYPE_MAP = {
    "fulltime": "fulltime",
    "parttime": "parttime",
    "internship": "internship",
    "contract": "contract",
}

@app.get("/api/jobs")
async def get_jobs(
    search: str = Query("", description="Job title or keywords"),
    location: str = Query("", description="Location (city, state, country)"),
    site_name: Optional[List[str]] = Query(None, description=f"Job boards: {', '.join(ALLOWED_SITES)}"),
    job_type: Optional[str] = Query(None, description="Job type: fulltime, parttime, internship, contract"),
    is_remote: Optional[bool] = Query(None, description="Filter for remote jobs only"),
    results_wanted: int = Query(20, ge=1, le=100, description="Number of results per page (max 100)"),
    hours_old: int = Query(168, ge=1, description="Time window in hours (default: 1 week)"),
):
    """
    Scrape job listings from multiple job boards using JobSpy.

    Returns a list of job postings with details like title, company, location, job URL, etc.
    """
    try:
        # Validate site_name if provided
        sites = site_name if site_name else DEFAULT_SITES
        invalid_sites = [s for s in sites if s not in ALLOWED_SITES]
        if invalid_sites:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid site_name values: {invalid_sites}. Allowed: {ALLOWED_SITES}"
            )

        # Naukri and Bayt require a search term - filter them out if search is empty
        if not search or not search.strip():
            sites = [s for s in sites if s not in ('naukri', 'bayt')]

        # Build Google search term if location is provided
        google_search_term = None
        if location:
            google_search_term = f"{search} jobs in {location}" if search else f"jobs in {location}"

        # JobSpy runs synchronously, so we run it in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()

        # Indeed limitation: can only use ONE filter from {hours_old, job_type/is_remote, easy_apply}
        # To avoid errors, we fetch without job_type/is_remote filters and apply them client-side
        # Only pass hours_old if indeed is NOT in sites OR if job_type/is_remote are not being used
        scrape_hours_old = hours_old
        if 'indeed' in sites and (job_type or is_remote is not None):
            # Indeed can't handle both hours_old and job_type/is_remote together
            scrape_hours_old = None

        # Build kwargs for scrape_jobs, only adding country_indeed if Indeed is in sites
        scrape_kwargs = {
            'site_name': sites,
            'search_term': search if search else None,
            'google_search_term': google_search_term,
            'location': location if location else None,
            'results_wanted': results_wanted,
            'hours_old': scrape_hours_old,
        }
        if 'indeed' in sites or 'glassdoor' in sites:
            scrape_kwargs['country_indeed'] = 'USA'

        jobs = await loop.run_in_executor(
            None,
            lambda: scrape_jobs(**scrape_kwargs)
        )

        # Convert DataFrame to list of dicts
        if jobs.empty:
            return []

        # Convert DataFrame to JSON using pandas' built-in NaN handling
        # pandas automatically converts NaN and NaT to null in JSON
        try:
            jobs_json = jobs.to_json(orient='records', date_format='iso', default_handler=str)
            jobs_list = json.loads(jobs_json)
        except Exception as e:
            # If to_json fails, manually convert with sanitization
            jobs_list = []
            for _, row in jobs.iterrows():
                job_dict = {}
                for col in jobs.columns:
                    val = row[col]
                    if pd.isna(val):
                        job_dict[col] = None
                    elif isinstance(val, (float, np.floating)) and (math.isnan(val) or math.isinf(val)):
                        job_dict[col] = None
                    elif hasattr(val, 'isoformat'):
                        try:
                            job_dict[col] = val.isoformat()
                        except:
                            job_dict[col] = str(val)
                    else:
                        job_dict[col] = val
                jobs_list.append(job_dict)

        # Filter by job_type if provided
        if job_type and job_type in JOB_TYPE_MAP:
            filtered = [j for j in jobs_list if j.get('job_type') == JOB_TYPE_MAP[job_type]]
            jobs_list = filtered

        # Filter by is_remote if provided
        if is_remote is not None:
            filtered = [j for j in jobs_list if j.get('is_remote') == is_remote]
            jobs_list = filtered

        # Generate a simple ID if missing (JobSpy doesn't provide one)
        for idx, job in enumerate(jobs_list):
            if 'id' not in job or not job['id']:
                # Use URL or combination to create an ID
                url = job.get('job_url', '')
                job['id'] = str(hash(url + job.get('title', '') + job.get('company', ''))) if url else f"job_{idx}"

        # Ensure site field is present
        for job in jobs_list:
            if 'site' not in job:
                # JobSpy includes site in the result; should already be there
                pass

        return JSONResponse(
            content=jobs_list,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error scraping jobs: {str(e)}")

# In-memory cache for job details
# Structure: { cache_key: { "data": JobDetails.dict(), "expires_at": timestamp } }
JOB_DETAILS_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


def get_cache_key(job_url: str) -> str:
    """Generate a cache key from job URL."""
    # Use a hash of the URL to keep keys short
    return f"job_details:{hash(job_url)}"


def get_from_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve from cache if not expired."""
    entry = JOB_DETAILS_CACHE.get(cache_key)
    if entry and entry["expires_at"] > time.time():
        return entry["data"]
    elif entry:
        # Expired - remove
        del JOB_DETAILS_CACHE[cache_key]
    return None


def set_cache(cache_key: str, data: Dict[str, Any]):
    """Store in cache with TTL."""
    expires_at = time.time() + CACHE_TTL_SECONDS
    JOB_DETAILS_CACHE[cache_key] = {
        "data": data,
        "expires_at": expires_at,
    }



@app.get("/api/job-details")
async def get_job_details(
    job_url: str = Query(..., description="URL of the job listing to scrape"),
    force_rescrape: bool = Query(False, description="If true, bypass cache and re-scrape"),
    use_llm: bool = Query(False, description="If true, use LLM to extract skills/salary from available data")
):
    """
    Scrape detailed job information (description, salary, skills) from a job URL.

    Returns enriched job details with:
    - description: Full job description text/HTML
    - salary: Structured salary info (min, max, currency, interval)
    - skills: List of required skills

    Results are cached for 7 days to reduce repeated scrapes.

    If use_llm=true, the backend will attempt to use OpenRouter LLM to extract
    skills and salary from any available description (even from JobSpy data).
    This is useful when direct scraping is blocked but JobSpy provides description.
    """
    if not job_url or not job_url.strip():
        raise HTTPException(status_code=400, detail="job_url is required")

    job_url = job_url.strip()

    # Check cache first (unless force_rescrape)
    cache_key = get_cache_key(job_url)
    if not force_rescrape:
        cached = get_from_cache(cache_key)
        if cached:
            return JSONResponse(
                content=cached,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                    "X-Cache": "HIT",
                }
            )

    # If LLM extraction is requested, try that first
    if use_llm:
        try:
            from scrapers.llm_extractor import LLMExtractor
            from scrapers.base import JobSalary

            # Try to get JobSpy data for this job URL
            # We'll scrape jobs with JobSpy for this specific URL - not efficient but works
            # Alternatively, the client could send description directly
            # For now, try direct scraper first to get any available data
            scraper_class = get_scraper_for_url(job_url)
            html_content = None

            if scraper_class:
                # Try to fetch the page (may fail due to blocking)
                scraper = scraper_class()
                timeout = Timeout(10.0, connect=5.0)
                async with AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    html = await scraper.fetch_with_retry(client, job_url)
                    if html:
                        html_content = html

            # If we got HTML, use it; otherwise, we'll need description from somewhere else
            # For now, if no HTML, fall through to regular scraping
            if html_content:
                extractor = LLMExtractor()
                llm_result = await extractor.extract(html_content)

                if llm_result.get("description") or llm_result.get("skills"):
                    # Build JobDetails from LLM result
                    salary = None
                    if llm_result.get("salary"):
                        salary = scraper.extract_salary(llm_result["salary"]) if scraper else None

                    details = JobDetails(
                        description=llm_result["description"] or "",
                        salary=salary,
                        skills=llm_result["skills"] or [],
                    )

                    result = details.to_dict()
                    result["job_url"] = job_url
                    result["scraped_at"] = datetime.utcnow().isoformat() + "Z"
                    result["extraction_method"] = "llm"

                    # Cache the result
                    set_cache(cache_key, result)

                    return JSONResponse(
                        content=result,
                        headers={
                            "Access-Control-Allow-Origin": "*",
                            "Content-Type": "application/json",
                            "X-Cache": "MISS",
                        }
                    )
        except Exception as e:
            print(f"WARNING: LLM extraction failed: {e}, falling back to regular scraping")

    # Find appropriate scraper (regular path)
    scraper_class = get_scraper_for_url(job_url)
    if not scraper_class:
        # Unknown site - return limited info
        return JSONResponse(
            content={
                "description": "Job details not available for this job board.",
                "salary": None,
                "skills": [],
                "error": "Unsupported job site"
            },
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            }
        )

    # Scrape the job details
    try:
        # Add small random delay to avoid rate limiting (0.5-2 seconds)
        await asyncio.sleep(0.5 + random.random() * 1.5)

        scraper = scraper_class()
        details = await scraper.scrape_details(job_url)

        # Debug logging
        import sys
        print(f"DEBUG: scraper = {scraper_class.__name__}, details type = {type(details)}", file=sys.stderr)
        print(f"DEBUG: details.salary = {details.salary}, has_desc = {bool(details.description)}, skills_count = {len(details.skills)}", file=sys.stderr)

        # Convert to dict for response
        result = details.to_dict()
        result["job_url"] = job_url
        result["scraped_at"] = datetime.utcnow().isoformat() + "Z"

        # Cache the result
        set_cache(cache_key, result)

        return JSONResponse(
            content=result,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
                "X-Cache": "MISS",
            }
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error scraping job details: {str(e)}")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "job-spy-api"}


@app.post("/api/extract-job-info")
async def extract_job_info(
    request: Request
):
    """
    Extract structured job information (skills, parsed salary) from a job description
    using LLM (OpenRouter). This endpoint enriches JobSpy data.

    Use this to get skills and better salary parsing from JobSpy descriptions.

    Expected JSON body:
    {
        "description": "Job description text (required, string)",
        "salary_text": "Optional salary information string"
    }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    description = body.get("description", "")
    salary_text = body.get("salary_text")

    if not description or not description.strip():
        raise HTTPException(status_code=400, detail="description is required")

    # Check for OPENROUTER_API_KEY
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        raise HTTPException(status_code=500, detail="LLM extraction not configured (OPENROUTER_API_KEY missing)")

    try:
        from scrapers.llm_extractor import LLMExtractor
        from scrapers.base import BaseScraper

        extractor = LLMExtractor(api_key=openrouter_key)

        # Combine description and salary_text if provided
        if salary_text:
            full_text = f"{description}\n\nSalary information: {salary_text}"
        else:
            full_text = description

        # Truncate for LLM context
        full_text = full_text[:15000]

        llm_result = await extractor.extract(full_text)

        # Check if LLM returned meaningful data
        has_description = llm_result.get("description") and len(llm_result["description"].strip()) > 10
        has_skills = llm_result.get("skills") and len(llm_result["skills"]) > 0
        has_salary = llm_result.get("salary") and len(str(llm_result["salary"]).strip()) > 0

        print(f"DEBUG: LLM result - desc_len={len(llm_result.get('description',''))}, skills={llm_result.get('skills')}, salary={llm_result.get('salary')}")
        print(f"DEBUG: falling back? {not (has_description or has_skills or has_salary)}")

        if not (has_description or has_skills or has_salary):
            # LLM returned empty/useless data - fall back to regex
            print("WARNING: LLM returned empty results, falling back to regex extraction")
            raise ValueError("LLM returned empty results, triggering fallback")

        # Parse salary if LLM returned a string
        salary = None
        if has_salary:
            # Use IndeedScraper's extract_salary method (inherited from BaseScraper)
            from scrapers.indeed import IndeedScraper
            scraper = IndeedScraper()
            salary = scraper.extract_salary(llm_result["salary"])

        result = {
            "skills": llm_result.get("skills", []),
            "salary": salary.to_dict() if salary else None,
            "description": llm_result.get("description", ""),
            "extraction_method": "llm",
        }

        return JSONResponse(
            content=result,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            }
        )

    except Exception as e:
        import traceback
        traceback.print_exc()

        # Fallback: Use rule-based extraction (regex) if LLM fails
        try:
            from scrapers.indeed import IndeedScraper
            scraper = IndeedScraper()

            # Extract skills using pattern matching
            skills = scraper.extract_skills(description)

            # Extract salary from description or salary_text
            salary_text_to_parse = salary_text or description
            salary = scraper.extract_salary(salary_text_to_parse) if salary_text_to_parse else None

            result = {
                "skills": skills,
                "salary": salary.to_dict() if salary else None,
                "description": description[:500],  # Truncated preview
                "extraction_method": "regex_fallback",
            }

            return JSONResponse(
                content=result,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                }
            )
        except Exception as fallback_error:
            raise HTTPException(status_code=500, detail=f"LLM extraction failed and fallback also failed: {str(e)}, fallback: {str(fallback_error)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
