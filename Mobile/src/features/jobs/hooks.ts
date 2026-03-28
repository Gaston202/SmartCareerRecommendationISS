import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchJobs } from '../../api/jobs';
import { JobListing, JobFilters } from '../../types/job';

interface UseJobListingsResult {
  jobs: JobListing[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useJobListings(filters: JobFilters = {}): UseJobListingsResult {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (currentFilters: JobFilters) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJobs(currentFilters);
      setJobs(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce search and location changes to avoid too many requests
    const debounceMs = 500;
    const hasTextSearch = filters.search && filters.search.trim().length > 0;
    const hasLocation = filters.location && filters.location.trim().length > 0;

    if (hasTextSearch || hasLocation) {
      debounceTimerRef.current = setTimeout(() => {
        fetchData(filters);
      }, debounceMs);
    } else {
      // For non-text filters (checkboxes, toggles, dropdowns), fetch immediately
      fetchData(filters);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(filters);
  }, [filters, fetchData]);

  return { jobs, loading, error, refetch };
}
