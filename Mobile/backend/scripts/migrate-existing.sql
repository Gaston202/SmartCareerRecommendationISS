-- Migration script for existing Supabase projects
-- This will ADD missing tables/columns without affecting existing data
-- Run this in your Supabase SQL Editor

-- ============================================
-- CHECK WHAT EXISTS AND ADD ONLY WHAT'S MISSING
-- ============================================

DO $$
DECLARE
  table_exists BOOLEAN;
  column_exists BOOLEAN;
BEGIN
  -- ============================================
  -- 1. USER_PROFILES (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE user_profiles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users ON DELETE CASCADE UNIQUE NOT NULL,
      full_name TEXT,
      avatar_url TEXT,
      bio TEXT,
      location TEXT,
      website TEXT,
      phone TEXT,
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
    RAISE NOTICE 'Created table: user_profiles';
  END IF;

  -- ============================================
  -- 2. QUIZ_SESSIONS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'quiz_sessions'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE quiz_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
      quiz_id TEXT DEFAULT 'career-fit-quiz',
      status TEXT CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
      current_question INTEGER DEFAULT 1,
      answers JSONB DEFAULT '[]',
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_quiz_sessions_user_id ON quiz_sessions(user_id);
    CREATE INDEX idx_quiz_sessions_completed ON quiz_sessions(user_id, completed_at DESC) WHERE completed_at IS NOT NULL;
    RAISE NOTICE 'Created table: quiz_sessions';
  END IF;

  -- ============================================
  -- 3. QUIZ_ANSWERS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'quiz_answers'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE quiz_answers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE NOT NULL,
      question_number INTEGER NOT NULL,
      question TEXT NOT NULL,
      selected_option TEXT NOT NULL,
      all_options JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_quiz_answers_session_id ON quiz_answers(session_id);
    CREATE INDEX idx_quiz_answers_question_number ON quiz_answers(session_id, question_number);
    CREATE UNIQUE INDEX idx_quiz_answers_unique ON quiz_answers(session_id, question_number);
    RAISE NOTICE 'Created table: quiz_answers';
  END IF;

  -- ============================================
  -- 4. CAREERS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'careers'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE careers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      required_skills TEXT[] NOT NULL DEFAULT '{}',
      preferred_interests TEXT[] DEFAULT '{}',
      typical_traits TEXT[] DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      salary_range_min INTEGER,
      salary_range_max INTEGER,
      growth_potential TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_careers_active ON careers(is_active) WHERE is_active = true;
    CREATE INDEX idx_careers_skills ON careers USING GIN(required_skills);
    CREATE INDEX idx_careers_interests ON careers USING GIN(preferred_interests);
    RAISE NOTICE 'Created table: careers';
  END IF;

  -- ============================================
  -- 5. CAREER_MATCH_RESULTS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'career_match_results'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE career_match_results (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      quiz_session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE NOT NULL,
      cv_analysis_id UUID,
      career_id UUID REFERENCES careers(id) NOT NULL,
      match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
      match_reasons TEXT[] DEFAULT '{}',
      ai_insights JSONB,
      ranking INTEGER NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, quiz_session_id, career_id)
    );

    CREATE INDEX idx_career_match_results_user_quiz ON career_match_results(user_id, quiz_session_id);
    CREATE INDEX idx_career_match_results_career ON career_match_results(career_id);
    CREATE INDEX idx_career_match_results_score ON career_match_results(match_score DESC);
    RAISE NOTICE 'Created table: career_match_results';
  END IF;

  -- ============================================
  -- 6. CV_ANALYSES (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'cv_analyses'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE cv_analyses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
      pdf_url TEXT NOT NULL,
      status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
      extracted_text TEXT,
      extracted_data JSONB,
      ats_score INTEGER CHECK (ats_score >= 0 AND ats_score <= 100),
      ats_issues JSONB DEFAULT '[]',
      suggested_improvements JSONB DEFAULT '[]',
      job_id TEXT,
      error_message TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_cv_analyses_user_id ON cv_analyses(user_id);
    CREATE INDEX idx_cv_analyses_status ON cv_analyses(user_id, status);
    CREATE INDEX idx_cv_analyses_created ON cv_analyses(created_at DESC);
    RAISE NOTICE 'Created table: cv_analyses';
  END IF;

  -- ============================================
  -- 7. CAREER_ROADMAPS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'career_roadmaps'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE career_roadmaps (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      career_id UUID REFERENCES careers(id) NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      milestones JSONB NOT NULL,
      total_duration_weeks INTEGER NOT NULL,
      embedding VECTOR(1536),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_career_roadmaps_career_id ON career_roadmaps(career_id);
    RAISE NOTICE 'Created table: career_roadmaps';
  END IF;

  -- ============================================
  -- 8. USER_ROADMAPS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_roadmaps'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE user_roadmaps (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
      career_roadmap_id UUID REFERENCES career_roadmaps(id) NOT NULL,
      personalized_content JSONB NOT NULL,
      used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, career_roadmap_id)
    );

    CREATE INDEX idx_user_roadmaps_user_id ON user_roadmaps(user_id);
    CREATE INDEX idx_user_roadmaps_used ON user_roadmaps(user_id, used_at DESC);
    RAISE NOTICE 'Created table: user_roadmaps';
  END IF;

  -- ============================================
  -- 9. ASYNC_JOBS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'async_jobs'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE async_jobs (
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

    CREATE INDEX idx_async_jobs_user_id ON async_jobs(user_id);
    CREATE INDEX idx_async_jobs_job_id ON async_jobs(job_id);
    CREATE INDEX idx_async_jobs_status ON async_jobs(user_id, status, created_at);
    RAISE NOTICE 'Created table: async_jobs';
  END IF;

  -- ============================================
  -- 10. API_AUDIT_LOGS (if not exists)
  -- ============================================
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'api_audit_logs'
  ) INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE api_audit_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      duration_ms INTEGER,
      request_ip INET,
      user_agent TEXT,
      request_body JSONB,
      response_size_bytes INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_api_audit_logs_user_id ON api_audit_logs(user_id);
    CREATE INDEX idx_api_audit_logs_created ON api_audit_logs(created_at DESC);
    CREATE INDEX idx_api_audit_logs_path_status ON api_audit_logs(path, status_code);
    RAISE NOTICE 'Created table: api_audit_logs';
  END IF;

  -- ============================================
  -- 11. TRIGGERS FOR UPDATED_AT
  -- ============================================
  -- Function for updated_at trigger
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  -- Apply triggers to tables that have updated_at column
  FOR table_name IN
    SELECT unnest(ARRAY[
      'user_profiles',
      'quiz_sessions',
      'cv_analyses',
      'careers',
      'career_roadmaps',
      'async_jobs'
    ])
  LOOP
    BEGIN
      EXECUTE format('
        CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      ', table_name, table_name);
      RAISE NOTICE 'Created trigger on: %', table_name;
    EXCEPTION
      WHEN OTHERS THEN NULL; -- Trigger might already exist
    END;
  END LOOP;

  RAISE NOTICE 'Migration completed successfully!';
END $$;
