-- =============================================
-- ADAPTATION MIGRATION FOR EXISTING SCHEMA
-- Adds missing columns to existing tables + creates new tables
-- Safe to run on existing data (does not drop/modify existing columns)
-- =============================================

-- ============================================
-- 1. ALTER user_quiz_sessions (add missing columns)
-- ============================================
ALTER TABLE user_quiz_sessions
ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS current_question INTEGER DEFAULT 1;

-- Add trigger for updated_at if column exists but trigger doesn't
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to user_quiz_sessions if it has updated_at column
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'user_quiz_sessions'
    AND column_name = 'updated_at'
  ) THEN
    CREATE TRIGGER update_user_quiz_sessions_updated_at
      BEFORE UPDATE ON user_quiz_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 2. ALTER careers (add missing columns)
-- ============================================
ALTER TABLE careers
ADD COLUMN IF NOT EXISTS preferred_interests TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS typical_traits TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS salary_range_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_range_max INTEGER,
ADD COLUMN IF NOT EXISTS growth_potential TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes for new array columns
CREATE INDEX IF NOT EXISTS idx_careers_interests ON careers USING GIN(preferred_interests);
CREATE INDEX IF NOT EXISTS idx_careers_traits ON careers USING GIN(typical_traits);
CREATE INDEX IF NOT EXISTS idx_careers_active ON careers(is_active) WHERE is_active = true;

-- ============================================
-- 3. ALTER cv_analysis (add missing columns)
-- ============================================
ALTER TABLE cv_analysis
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS job_id TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_cv_analysis_user_status ON cv_analysis(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cv_analysis_created ON cv_analysis(created_at DESC);

-- ============================================
-- 4. CREATE career_roadmaps (new table)
-- ============================================
CREATE TABLE IF NOT EXISTS career_roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  career_id UUID REFERENCES careers(id) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  milestones JSONB NOT NULL,
  total_duration_weeks INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_roadmaps_career_id ON career_roadmaps(career_id);

-- ============================================
-- 5. CREATE user_roadmaps (new table)
-- ============================================
CREATE TABLE IF NOT EXISTS user_roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  career_roadmap_id UUID REFERENCES career_roadmaps(id) NOT NULL,
  personalized_content JSONB NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, career_roadmap_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roadmaps_user_id ON user_roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roadmaps_used ON user_roadmaps(user_id, used_at DESC);

-- ============================================
-- 6. CREATE async_jobs (new table)
-- ============================================
CREATE TABLE IF NOT EXISTS async_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'active', 'completed', 'failed', 'delayed')) DEFAULT 'pending',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  result_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_async_jobs_user_id ON async_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_async_jobs_job_id ON async_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_async_jobs_status ON async_jobs(user_id, status, created_at);

-- ============================================
-- 7. ROW LEVEL SECURITY
-- ============================================
-- Enable RLS on new tables
ALTER TABLE career_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roadmaps (users can access own)
CREATE POLICY "Users can view own roadmaps" ON user_roadmaps
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for async_jobs (users can access own)
CREATE POLICY "Users can view own jobs" ON async_jobs
  FOR ALL USING (user_id = auth.uid());

-- career_roadmaps: public read access (anyone can view templates)
-- No RLS policy needed, or add:
-- CREATE POLICY "Career roadmaps are publicly readable" ON career_roadmaps
--   FOR SELECT USING (true);

-- ============================================
-- 8. TRIGGERS FOR UPDATED_AT ON NEW TABLES
-- ============================================
DO $$
BEGIN
  -- career_roadmaps
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'career_roadmaps'
    AND column_name = 'updated_at'
  ) THEN
    CREATE TRIGGER update_career_roadmaps_updated_at
      BEFORE UPDATE ON career_roadmaps
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- user_roadmaps
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'user_roadmaps'
    AND column_name = 'updated_at'
  ) THEN
    CREATE TRIGGER update_user_roadmaps_updated_at
      BEFORE UPDATE ON user_roadmaps
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- async_jobs
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'async_jobs'
    AND column_name = 'updated_at'
  ) THEN
    CREATE TRIGGER update_async_jobs_updated_at
      BEFORE UPDATE ON async_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 9. SEED SAMPLE CAREER ROADMAPS (if careers exist)
-- ============================================
DO $$
DECLARE
  career_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO career_count FROM careers;

  IF career_count > 0 THEN
    RAISE NOTICE 'Found % careers, you may want to add roadmap templates', career_count;
    RAISE NOTICE 'Insert roadmap templates using INSERT INTO career_roadmaps (...)';
  END IF;
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
SELECT 'Migration completed successfully!' as message;
