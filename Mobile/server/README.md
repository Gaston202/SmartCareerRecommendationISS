# Job Spy API

FastAPI backend for job listings using the JobSpy library.

## Setup

### Prerequisites
- Python 3.10 or newer (3.11 recommended)
- pip (latest version)

### Installation

1. (Optional) Create a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

2. **Important**: Upgrade pip first to avoid numpy installation issues:
   ```bash
   pip install --upgrade pip
   ```

3. Install dependencies (if numpy fails, see Troubleshooting below):
   ```bash
   pip install -r requirements.txt
   ```

   **Alternative installation if you encounter numpy build errors**:
   ```bash
   # Install numpy separately with pre-built wheel
   pip install --only-binary :all: numpy
   # Then install remaining dependencies
   pip install fastapi uvicorn[standard] python-jobspy
   ```

4. Run the server:
   - On macOS/Linux:
     ```bash
     ./run.sh
     ```
   - On Windows:
     ```bash
     run.bat
     ```
   Or manually:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
   (Use `--reload` flag for development)

5. The API will be available at: http://localhost:8000

6. API documentation (Swagger UI): http://localhost:8000/docs

## API Endpoint

### GET /api/jobs

Scrape job listings from multiple job boards.

**Query Parameters:**
- `search` (string): Job title or keywords (optional)
- `location` (string): City, state, or country (optional)
- `site_name` (list): Job boards: indeed, linkedin, zip_recruiter, glassdoor, google, bayt, naukri (optional, defaults to all)
- `job_type` (string): Filter by job type: fulltime, parttime, internship, contract (optional)
- `is_remote` (bool): Filter for remote jobs only (optional)
- `results_wanted` (int): Number of results (1-100, default 20)
- `hours_old` (int): Time window in hours (default 168 ≈ 1 week)

**Example:**
```
http://localhost:8000/api/jobs?search=software%20engineer&location=San%20Francisco&results_wanted=10
```

**Response:**
JSON array of job objects with fields:
- `id`, `title`, `company`, `company_url`, `job_url`, `location`
- `country`, `city`, `state`, `is_remote`, `description`
- `job_type`, `job_level`, `salary` (object), `date_posted`
- `emails`, `company_industry`, `skills`, `site`

**Notes:**
- Job scraping can be slow (5-30 seconds) depending on the number of sites and results.
- Some job boards may block scraping or return limited results.
- For production use, consider using official APIs (LinkedIn, Indeed) or adding proxy rotation.
- The `site_name` parameter filters which job boards to query. Allowed values: indeed, linkedin, zip_recruiter, glassdoor, google, bayt, naukri.

### GET /health

Health check endpoint. Returns `{"status": "ok", "service": "job-spy-api"}`.

## Frontend Integration

Set `EXPO_PUBLIC_JOB_API_URL=http://localhost:8000` in your React Native `.env` file.

Then use the `fetchJobs` function from `Mobile/src/api/jobs.ts`.

## Rate Limiting & Best Practices

- JobSpy does not include built-in rate limiting. Be mindful of request frequency.
- Use caching on the frontend to avoid repeated scrapes.
- For high-traffic deployments, add a reverse proxy with rate limiting (e.g., Nginx).
- Consider storing scraped results in a database (e.g., Supabase) with TTL to reduce live scraping.

## Limitations

- JobSpy scrapes publicly available listings; some sites may block or limit scrapes.
- Job data structure varies between boards; some fields may be missing.
- JobSpy does not natively support pagination - it fetches up to `results_wanted` in one go.
- Salaries are often not available or may be estimated from description.

## Troubleshooting

### numpy installation fails on Windows
If you see errors like "meson-python: error: Could not find meson version" or "Failed to build numpy":

1. **Upgrade pip** (required for pre-built wheels):
   ```bash
   python -m pip install --upgrade pip
   ```

2. **Install numpy separately with binary wheel only**:
   ```bash
   pip install --only-binary :all: numpy
   ```

   Alternatively, download a pre-built wheel from https://pypi.org/project/numpy/#files and install it:
   ```bash
   pip install path\to\numpy‑1.26.3‑cp313‑cp313‑win_amd64.whl
   ```

3. Then install the rest:
   ```bash
   pip install fastapi uvicorn[standard] python-jobspy
   ```

### ImportError: No module named jobspy
- Make sure you ran `pip install -r requirements.txt` or the alternative commands above.

### Timeout errors
- Job scraping can take 10-30 seconds depending on the number of sites.
- Increase the timeout on the client side (React Native fetch) if needed.
- Try reducing the number of job boards or results per request.

### Empty results
- Try broadening your search (fewer keywords, larger location).
- Some job boards may block scrapers; try different site_name filters.
- Check that the job boards you're targeting actually have listings.

### 403/429 errors from job sites
- The site may be blocking your IP. Use proxies (JobSpy supports a `proxies` parameter, but not exposed in this API for simplicity).
- Reduce request frequency to avoid being banned.
- For production, consider using official APIs (LinkedIn, Indeed) instead of scraping.

## License

Part of the SmartCareerRecommendationISS project.
