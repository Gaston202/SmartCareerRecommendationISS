-- =============================================
-- SMART CAREER RECOMMENDATION - PRODUCTION SCHEMA
-- Supabase PostgreSQL
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USERS EXTENSION (extends Supabase Auth)
-- =============================================
CREATE TABLE IF NOT EXISTS user_profiles (
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

-- =============================================
-- QUIZ SYSTEM (Stateful Sessions)
-- =============================================
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  quiz_id TEXT DEFAULT 'career-fit-quiz',
  status TEXT CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
  current_question INTEGER DEFAULT 1,
  answers JSONB DEFAULT '[]', -- Array of { question_number, answer }
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX idx_quiz_sessions_completed ON quiz_sessions(user_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_quiz_sessions_created ON quiz_sessions(created_at DESC);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  question_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  all_options JSONB NOT NULL, -- Array of all options for that question
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_answers_session_id ON quiz_answers(session_id);
CREATE INDEX idx_quiz_answers_question_number ON quiz_answers(session_id, question_number);
CREATE UNIQUE INDEX idx_quiz_answers_unique ON quiz_answers(session_id, question_number);

-- =============================================
-- CAREER REFERENCE DATA & MATCHING
-- =============================================
CREATE TABLE IF NOT EXISTS careers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_interests TEXT[] DEFAULT '{}',
  typical_traits TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  salary_range_min INTEGER,
  salary_range_max INTEGER,
  growth_potential TEXT, -- e.g., 'high', 'medium', 'low'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_careers_active ON careers(is_active) WHERE is_active = true;
CREATE INDEX idx_careers_skills ON careers USING GIN(required_skills);
CREATE INDEX idx_careers_interests ON careers USING GIN(preferred_interests);
CREATE INDEX idx_careers_traits ON careers USING GIN(typical_traits);

-- Insert sample careers
INSERT INTO careers (title, description, required_skills, preferred_interests, typical_traits, tags, salary_range_min, salary_range_max, growth_potential)
VALUES
  (
    'Software Engineer',
    'Design, build, and maintain robust technical solutions.',
    ARRAY['JavaScript', 'Python', 'React', 'Node.js', 'SQL'],
    ARRAY['Technology', 'Innovation', 'Problem Solving', 'Continuous Learning'],
    ARRAY['Analytical', 'Detail-oriented', 'Independent', 'Logical'],
    ARRAY['Technology', 'Engineering', 'Development'],
    60000,
    150000,
    'high'
  ),
  (
    'Product Manager',
    'Lead product vision and coordinate cross-functional teams.',
    ARRAY['Strategy', 'Market Research', 'User Stories', 'Agile', 'Analytics'],
    ARRAY['Leadership', 'Strategy', 'Innovation', 'User Impact'],
    ARRAY['Strategic', 'Collaborative', 'Decisive', 'Empathetic'],
    ARRAY['Product', 'Management', 'Strategy'],
    80000,
    180000,
    'high'
  ),
  (
    'Data Analyst',
    'Transform data into actionable recommendations for decisions.',
    ARRAY['SQL', 'Python', 'Data Visualization', 'Statistics', 'Excel'],
    ARRAY['Analytics', 'Data', 'Business Intelligence', 'Insights'],
    ARRAY['Analytical', 'Detail-oriented', 'Curious', 'Methodical'],
    ARRAY['Data', 'Analytics', 'Business Decisions'],
    55000,
    120000,
    'high'
  ),
  (
    'UX Designer',
    'Create intuitive, user-centered digital experiences.',
    ARRAY['Figma', 'User Research', 'Prototyping', 'UI Design', 'Accessibility'],
    ARRAY['Design', 'Creativity', 'User Experience', 'Empathy'],
    ARRAY['Creative', 'Empathetic', 'Detail-oriented', 'Collaborative'],
    ARRAY['Design', 'User Experience', 'Creative'],
    60000,
    130000,
    'medium'
  ),
  (
    'Marketing Specialist',
    'Develop and execute marketing campaigns to reach target audiences.',
    ARRAY['Digital Marketing', 'SEO', 'Content Creation', 'Analytics', 'Social Media'],
    ARRAY['Marketing', 'Creativity', 'Communication', 'Growth'],
    ARRAY['Creative', 'Outgoing', 'Strategic', 'Adaptable'],
    ARRAY['Marketing', 'Communications', 'Growth'],
    50000,
    100000,
    'medium'
  );

CREATE TABLE IF NOT EXISTS career_match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quiz_session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  cv_analysis_id UUID, -- nullable, might not have CV yet
  career_id UUID REFERENCES careers(id) NOT NULL,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons TEXT[] DEFAULT '{}',
  ai_insights JSONB, -- AI-generated explanation
  ranking INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quiz_session_id, career_id)
);

CREATE INDEX idx_career_match_results_user_quiz ON career_match_results(user_id, quiz_session_id);
CREATE INDEX idx_career_match_results_career ON career_match_results(career_id);
CREATE INDEX idx_career_match_results_score ON career_match_results(match_score DESC);

-- =============================================
-- CV ANALYSIS PIPELINE (ASYNC)
-- =============================================
CREATE TABLE IF NOT EXISTS cv_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  pdf_url TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  extracted_text TEXT, -- Full extracted text from PDF
  extracted_data JSONB, -- Structured data: { skills[], experience[], education[], summary? }
  ats_score INTEGER CHECK (ats_score >= 0 AND ats_score <= 100),
  ats_issues JSONB DEFAULT '[]', -- Array of { type, severity, description, fix? }
  suggested_improvements JSONB DEFAULT '[]', -- Array of { section, suggestion, example? }
  job_id TEXT, -- BullMQ job ID for tracking
  error_message TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cv_analyses_user_id ON cv_analyses(user_id);
CREATE INDEX idx_cv_analyses_status ON cv_analyses(user_id, status);
CREATE INDEX idx_cv_analyses_created ON cv_analyses(created_at DESC);

-- =============================================
-- ROADMAPS (RAG - Templates + Personalization)
-- =============================================
CREATE TABLE IF NOT EXISTS career_roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  career_id UUID REFERENCES careers(id) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  milestones JSONB NOT NULL, -- Array of { id, title, description, duration_weeks, tasks[], resources[] }
  total_duration_weeks INTEGER NOT NULL,
  embedding VECTOR(1536), -- OpenAI embedding vector for similarity search (if using pgvector)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_career_roadmaps_career_id ON career_roadmaps(career_id);
CREATE INDEX idx_career_roadmaps_embedding ON career_roadmaps USING hnsw(embedding vector_cosine_ops) IF EXISTS(embedding);

CREATE TABLE IF NOT EXISTS user_roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  career_roadmap_id UUID REFERENCES career_roadmaps(id) NOT NULL,
  personalized_content JSONB NOT NULL, -- Customized milestones
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, career_roadmap_id)
);

CREATE INDEX idx_user_roadmaps_user_id ON user_roadmaps(user_id);
CREATE INDEX idx_user_roadmaps_used ON user_roadmaps(user_id, used_at DESC);

-- =============================================
-- JOB QUEUE TRACKING (for async status polling)
-- =============================================
CREATE TABLE IF NOT EXISTS async_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL, -- 'cv_analysis', 'roadmap_generation', 'bulk_upload'
  job_id TEXT UNIQUE NOT NULL, -- BullMQ job ID
  status TEXT CHECK (status IN ('pending', 'active', 'completed', 'failed', 'delayed')) DEFAULT 'pending',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  result_url TEXT, -- URL to fetch result (e.g., CV analysis result)
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

-- =============================================
-- AUDIT LOGGING
-- =============================================
CREATE TABLE IF NOT EXISTS api_audit_logs (
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

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own quiz sessions" ON quiz_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own quiz answers" ON quiz_answers
  FOR ALL USING (
    session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own CV analyses" ON cv_analyses
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own career matches" ON career_match_results
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own roadmaps" ON user_roadmaps
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own jobs" ON async_jobs
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quiz_sessions_updated_at BEFORE UPDATE ON quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cv_analyses_updated_at BEFORE UPDATE ON cv_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_careers_updated_at BEFORE UPDATE ON careers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_career_roadmaps_updated_at BEFORE UPDATE ON career_roadmaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_async_jobs_updated_at BEFORE UPDATE ON async_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCTIONS & VIEWS
-- =============================================

-- Get Nova profile from quiz answers (for AI enhancement)
CREATE OR REPLACE FUNCTION get_nova_profile_from_answers(
  answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  -- Placeholder for complex DISC calculation
  -- In production, you'd implement the same logic as the frontend fallback
  RETURN jsonb_build_object(
    'disc_percentages', jsonb_build_object('red', 25, 'yellow', 25, 'green', 25, 'blue', 25),
    'dominant_style', 'balanced'
  );
END;
$$;

-- View for user's latest quiz results
CREATE OR REPLACE VIEW user_latest_quiz_results AS
SELECT
  qs.user_id,
  qs.id as session_id,
  qs.completed_at,
  jsonb_agg(
    jsonb_build_object(
      'career_id', cmr.career_id,
      'title', c.title,
      'match_score', cmr.match_score,
      'ranking', cmr.ranking,
      'ai_explanation', cmr.ai_insights
    ) ORDER BY cmr.ranking
  ) as career_matches
FROM quiz_sessions qs
LEFT JOIN career_match_results cmr ON cmr.quiz_session_id = qs.id
LEFT JOIN careers c ON c.id = cmr.career_id
WHERE qs.status = 'completed'
GROUP BY qs.user_id, qs.id, qs.completed_at;

-- =============================================
-- STORAGE SETUP (Run these in Supabase SQL console)
-- =============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('cv-uploads', 'cv-uploads', false);
-- Then run: ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- Policy for authenticated uploads:
-- CREATE POLICY "Users can upload own CVs" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
-- Policy for authenticated reads:
-- CREATE POLICY "Users can read own CVs" ON storage.objects
--   FOR SELECT USING (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- INITIAL DATA SEEDING
-- =============================================
-- Insert default careers if table empty (already done above)
-- Ensure RLS policies are in place before allowing user access
