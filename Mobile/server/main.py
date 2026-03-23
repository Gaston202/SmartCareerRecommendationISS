from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jobspy import scrape_jobs
from typing import List, Optional
import asyncio
import json
import math
import pandas
import numpy as np

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
        sites = site_name if site_name else ALLOWED_SITES
        invalid_sites = [s for s in sites if s not in ALLOWED_SITES]
        if invalid_sites:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid site_name values: {invalid_sites}. Allowed: {ALLOWED_SITES}"
            )

        # Build Google search term if location is provided
        google_search_term = None
        if location:
            google_search_term = f"{search} jobs in {location}" if search else f"jobs in {location}"

        # JobSpy runs synchronously, so we run it in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        jobs = await loop.run_in_executor(
            None,
            lambda: scrape_jobs(
                site_name=sites,
                search_term=search if search else None,
                google_search_term=google_search_term,
                location=location if location else None,
                results_wanted=results_wanted,
                hours_old=hours_old,
                country_indeed='USA' if 'indeed' in sites else None,
                # Note: linkedIn fetch description is slower, enable if needed
                # linkedin_fetch_description=True,
            )
        )

        # Convert DataFrame to list of dicts
        if jobs.empty:
            return []

        # Convert DataFrame to JSON using pandas' built-in NaN handling
        # pandas automatically converts NaN and NaT to null in JSON
        jobs_json = jobs.to_json(orient='records', date_format='iso', default_handler=str)
        jobs_list = json.loads(jobs_json)

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

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "job-spy-api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
