-- Create user_profiles table for storing merged quiz + CV profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    interests TEXT[] DEFAULT ARRAY[]::TEXT[],
    hobbies TEXT[] DEFAULT ARRAY[]::TEXT[],
    strengths TEXT[] DEFAULT ARRAY[]::TEXT[],
    work_preferences TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferred_problems TEXT[] DEFAULT ARRAY[]::TEXT[],
    cv_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
    cv_projects TEXT[] DEFAULT ARRAY[]::TEXT[],
    cv_background TEXT,
    inferred_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
    inferred_interests TEXT[] DEFAULT ARRAY[]::TEXT[],
    disliked_tasks TEXT[] DEFAULT ARRAY[]::TEXT[],
    evidence JSONB DEFAULT '{}'::JSONB,
    confidence NUMERIC(3, 2) DEFAULT 0.5,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_quiz_sessions table for tracking quiz progress
CREATE TABLE IF NOT EXISTS user_quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    quiz_id TEXT DEFAULT 'career-fit-quiz',
    status TEXT DEFAULT 'in_progress', -- 'in_progress' | 'completed'
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quiz_id)
);

-- Create user_quiz_responses table for storing answers (with upsert key)
CREATE TABLE IF NOT EXISTS user_quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES user_quiz_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    question_number INTEGER NOT NULL,
    question TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    all_options TEXT[] DEFAULT ARRAY[]::TEXT[],
    reasoning TEXT,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Composite unique constraint to prevent duplicates and enable upsert
    UNIQUE(session_id, question_number)
);

-- Create cv_analyses table for storing CV analysis results
CREATE TABLE IF NOT EXISTS cv_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    cv_text TEXT NOT NULL,
    summary TEXT,
    extracted_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
    extracted_projects TEXT[] DEFAULT ARRAY[]::TEXT[],
    extracted_experience TEXT[] DEFAULT ARRAY[]::TEXT[],
    extracted_education TEXT[] DEFAULT ARRAY[]::TEXT[],
    strengths TEXT[] DEFAULT ARRAY[]::TEXT[],
    improvements JSONB DEFAULT '[]'::JSONB, -- Array of improvement objects
    profile_updates JSONB DEFAULT '{}'::JSONB,
    analysis_version TEXT DEFAULT 'v2',
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create career_match_results table for storing matching results
CREATE TABLE IF NOT EXISTS career_match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    cv_analysis_id UUID REFERENCES cv_analyses(id),
    quiz_session_id UUID REFERENCES user_quiz_sessions(id),
    careers JSONB DEFAULT '[]'::JSONB, -- Array of career matches
    confidence_score NUMERIC(3, 2),
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_sessions_user_id ON user_quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_responses_session_id ON user_quiz_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_responses_user_id ON user_quiz_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_user_id ON cv_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_career_match_results_user_id ON career_match_results(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_match_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow authenticated users to see their own data)
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (true); -- Can read all for now, implement auth later
    
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (true);
