import { JobListing, JobFilters } from '../types/job';

const API_BASE_URL = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_JOB_API_URL || 'http://localhost:8000';

export async function fetchJobs(filters: JobFilters = {}): Promise<JobListing[]> {
  const { search, location, siteNames, jobType, isRemoteOnly, resultsWanted = 20, hoursOld = 168 } = filters;

  try {
    // Build query params
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (location) params.append('location', location);
    if (siteNames && siteNames.length > 0) {
      siteNames.forEach(site => params.append('site_name', site));
    }
    if (jobType) params.append('job_type', jobType);
    if (isRemoteOnly !== undefined) params.append('is_remote', String(isRemoteOnly));
    params.append('results_wanted', String(resultsWanted));
    params.append('hours_old', String(hoursOld));

    const response = await fetch(`${API_BASE_URL}/api/jobs?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Failed to fetch jobs: ${errorMessage}`);
    }

    const data: JobListing[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching jobs:', error);
    throw error;
  }
}
