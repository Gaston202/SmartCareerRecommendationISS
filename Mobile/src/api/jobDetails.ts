import { JobEnrichedDetails, JobExtractedInfo } from '../types/job';

const API_BASE_URL = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_JOB_API_URL || 'http://localhost:8000';

/**
 * Fetch detailed job information from the job URL.
 * This endpoint scrapes the job page for salary, description, and skills.
 */
export async function fetchJobDetails(jobUrl: string): Promise<JobEnrichedDetails> {
  if (!jobUrl) {
    throw new Error('Job URL is required');
  }

  const url = `${API_BASE_URL}/api/job-details?job_url=${encodeURIComponent(jobUrl)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Failed to fetch job details: ${errorMessage}`);
    }

    const data: JobEnrichedDetails = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching job details:', error);
    throw error;
  }
}

/**
 * Extract job skills and salary from a description using LLM.
 * Use this to enrich JobSpy listings that have descriptions but lack skills.
 */
export async function extractJobInfo(description: string, salaryText?: string): Promise<JobExtractedInfo> {
  if (!description) {
    throw new Error('Description is required');
  }

  const url = `${API_BASE_URL}/api/extract-job-info`;

  const body: Record<string, string> = { description };
  if (salaryText) {
    body.salary_text = salaryText;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Failed to extract job info: ${errorMessage}`);
    }

    const data: JobExtractedInfo = await response.json();
    return data;
  } catch (error) {
    console.error('Error extracting job info:', error);
    throw error;
  }
}
