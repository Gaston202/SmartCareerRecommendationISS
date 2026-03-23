export interface JobLocation {
  country?: string;
  city?: string;
  state?: string;
}

export interface JobSalary {
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  interval?: 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly';
  source?: 'direct_data' | 'description';
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  company_url?: string;
  job_url: string;
  location: string;
  country?: string;
  city?: string;
  state?: string;
  is_remote: boolean;
  description?: string;
  job_type: 'fulltime' | 'parttime' | 'internship' | 'contract';
  job_level?: string;
  salary?: JobSalary;
  salary_range?: string; // Formatted as "$120k - $150k" if parsed
  date_posted?: string;
  emails?: string[];
  company_industry?: string;
  skills?: string[];
  site: string; // which job board: indeed, linkedin, glassdoor, etc.
}

export interface JobFilters {
  search?: string;
  location?: string;
  siteNames?: string[]; // default: all sites
  jobType?: 'fulltime' | 'parttime' | 'internship' | 'contract';
  isRemoteOnly?: boolean;
  resultsWanted?: number;
  hoursOld?: number;
}
