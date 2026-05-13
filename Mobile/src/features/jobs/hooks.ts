import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJobs, fetchRecommendedJobs } from '../../api/jobs';
import { JobFilters, JobListing } from '../../types/job';

interface UseJobListingsResult {
  jobs: JobListing[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function serializeFilters(filters: JobFilters): string {
  return JSON.stringify({
    search: filters.search ?? '',
    location: filters.location ?? '',
    siteNames: [...(filters.siteNames ?? [])].sort(),
    jobType: filters.jobType ?? null,
    isRemoteOnly: filters.isRemoteOnly ?? false,
    resultsWanted: filters.resultsWanted ?? 20,
    hoursOld: filters.hoursOld ?? 168,
  });
}

interface UseRecommendedJobsResult {
  jobs: JobListing[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRecommendedJobs(
  skills: string[],
  specialty: string,
  location?: string,
  careerSuggestions?: string[],
): UseRecommendedJobsResult {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const skillsKey = useMemo(() => [...skills].sort().join(','), [skills]);
  const suggestionsKey = useMemo(() => (careerSuggestions ?? []).join(','), [careerSuggestions]);

  const loadJobs = useCallback(async () => {
    if (!skills.length && !specialty && !careerSuggestions?.length) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRecommendedJobs(skills, specialty, location, 15, careerSuggestions);
      setJobs(data);
    } catch (err) {
      setJobs([]);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [skillsKey, specialty, location, suggestionsKey]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return { jobs, loading, error, refetch: loadJobs };
}

export function useJobListings(filters: JobFilters = {}): UseJobListingsResult {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const filterKey = useMemo(() => serializeFilters(filters), [filters]);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJobs(filters);
      setJobs(data);
    } catch (err) {
      setJobs([]);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return { jobs, loading, error, refetch: loadJobs };
}
