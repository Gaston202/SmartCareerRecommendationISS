-- =============================================
-- VERIFY CV_ANALYSIS TABLE HAS REQUIRED COLUMNS
-- The table already has extracted_skills and extracted_interests as JSONB
-- Code already handles JSONB arrays correctly
-- =============================================

-- Verify current structure matches expectations
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'cv_analyses'
  AND column_name IN ('extracted_skills', 'extracted_interests', 'extracted_text', 'pdf_url', 'status', 'ats_score', 'ats_issues', 'suggested_improvements', 'career_suggestions', 'completed_at', 'job_id', 'error_message')
ORDER BY ordinal_position;

-- Add helpful comments if not already present
DO $$ 
BEGIN
  COMMENT ON COLUMN cv_analyses.extracted_skills IS 'Array of skills extracted from CV (stored as JSONB array, populated by AI analysis worker)';
  COMMENT ON COLUMN cv_analyses.extracted_interests IS 'Array of interests inferred from CV content (stored as JSONB array, populated by AI analysis worker)';
  COMMENT ON COLUMN cv_analyses.extracted_text IS 'Full extracted text from CV PDF';
  COMMENT ON COLUMN cv_analyses.pdf_url IS 'Public URL to uploaded CV PDF';
  COMMENT ON COLUMN cv_analyses.status IS 'Processing status: pending, processing, completed, failed';
  COMMENT ON COLUMN cv_analyses.ats_score IS 'ATS compatibility score (0-100)';
  COMMENT ON COLUMN cv_analyses.ats_issues IS 'Array of ATS issues detected';
  COMMENT ON COLUMN cv_analyses.suggested_improvements IS 'Array of suggested CV improvements';
  COMMENT ON COLUMN cv_analyses.career_suggestions IS 'Array of suggested career paths from CV analysis';
  COMMENT ON COLUMN cv_analyses.completed_at IS 'Timestamp when analysis completed';
  COMMENT ON COLUMN cv_analyses.job_id IS 'Background job ID for tracking';
  COMMENT ON COLUMN cv_analyses.error_message IS 'Error message if analysis failed';
EXCEPTION
  WHEN OTHERS THEN
    -- Comments might already exist, that's fine
    NULL;
END $$;

-- Verify the table has all expected columns
DO $$
DECLARE
  missing_cols text[];
BEGIN
  SELECT ARRAY_AGG(column_name) INTO missing_cols
  FROM information_schema.columns
  WHERE table_name = 'cv_analyses'
    AND column_name IN (
      'extracted_skills', 'extracted_interests', 'extracted_text', 'pdf_url', 
      'status', 'ats_score', 'ats_issues', 'suggested_improvements', 
      'career_suggestions', 'completed_at', 'job_id', 'error_message'
    );
  
  IF array_length(missing_cols, 1) <> 12 THEN
    RAISE EXCEPTION 'Missing columns in cv_analyses table: %', 
      ARRAY['extracted_skills', 'extracted_interests', 'extracted_text', 'pdf_url', 
            'status', 'ats_score', 'ats_issues', 'suggested_improvements', 
            'career_suggestions', 'completed_at', 'job_id', 'error_message'] 
            EXCEPT missing_cols;
  END IF;
END $$;

-- Final verification
SELECT 'cv_analyses table structure verified successfully' as status;
