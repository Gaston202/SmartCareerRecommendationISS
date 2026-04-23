-- =============================================
-- LEARNING ROADMAP SCHEMA
-- Adds support for skill-based learning paths
-- =============================================

-- 1. CREATE learning_skills table
CREATE TABLE IF NOT EXISTS learning_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  duration_hours INTEGER NOT NULL CHECK (duration_hours > 0),
  category TEXT NOT NULL, -- e.g., "Backend", "Frontend", "DevOps", "Data Science"
  importance TEXT NOT NULL CHECK (importance IN ('critical', 'important', 'nice-to-have')) DEFAULT 'important',
  career_id UUID REFERENCES careers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_skills_name ON learning_skills(name);
CREATE INDEX idx_learning_skills_category ON learning_skills(category);
CREATE INDEX idx_learning_skills_career ON learning_skills(career_id);

-- 2. CREATE skill_dependencies table
CREATE TABLE IF NOT EXISTS skill_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_skill_id UUID NOT NULL REFERENCES learning_skills(id) ON DELETE CASCADE,
  to_skill_id UUID NOT NULL REFERENCES learning_skills(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('required', 'recommended')) DEFAULT 'required',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_dependency UNIQUE(from_skill_id, to_skill_id)
);

CREATE INDEX idx_skill_dependencies_from ON skill_dependencies(from_skill_id);
CREATE INDEX idx_skill_dependencies_to ON skill_dependencies(to_skill_id);

-- 3. CREATE learning_courses table
CREATE TABLE IF NOT EXISTS learning_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id UUID NOT NULL REFERENCES learning_skills(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL, -- e.g., "Khan Academy", "Udemy", "Coursera", "freeCodeCamp"
  url TEXT NOT NULL UNIQUE,
  duration_hours INTEGER,
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5),
  students_count INTEGER,
  free BOOLEAN DEFAULT FALSE,
  course_type TEXT CHECK (course_type IN ('video', 'interactive', 'text', 'project-based', 'live')) DEFAULT 'video',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_courses_skill ON learning_courses(skill_id);
CREATE INDEX idx_learning_courses_provider ON learning_courses(provider);

-- 4. CREATE user_learning_roadmaps table
CREATE TABLE IF NOT EXISTS user_learning_roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  career_id UUID REFERENCES careers(id) ON DELETE SET NULL,
  career_title TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skills JSONB NOT NULL, -- Stores skill nodes with courses as JSON
  total_duration_hours INTEGER,
  estimated_weeks INTEGER,
  skill_count INTEGER,
  personalization_data JSONB DEFAULT '{}', -- User's learning preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_learning_roadmaps_user ON user_learning_roadmaps(user_id);
CREATE INDEX idx_user_learning_roadmaps_career ON user_learning_roadmaps(career_id);
CREATE INDEX idx_user_learning_roadmaps_created ON user_learning_roadmaps(user_id, created_at DESC);

-- 5. CREATE user_skill_progress table
CREATE TABLE IF NOT EXISTS user_skill_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES learning_skills(id) ON DELETE CASCADE,
  roadmap_id UUID REFERENCES user_learning_roadmaps(id) ON DELETE CASCADE,
  started BOOLEAN DEFAULT FALSE,
  completed_percentage INTEGER CHECK (completed_percentage >= 0 AND completed_percentage <= 100) DEFAULT 0,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_skill_progress UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skill_progress_user ON user_skill_progress(user_id);
CREATE INDEX idx_user_skill_progress_skill ON user_skill_progress(skill_id);
CREATE INDEX idx_user_skill_progress_roadmap ON user_skill_progress(roadmap_id);

-- 6. CREATE user_course_enrollment table
CREATE TABLE IF NOT EXISTS user_course_enrollment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100) DEFAULT 0,
  rating INTEGER CHECK (rating >= 0 AND rating <= 5),
  review TEXT,
  certificate_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_course_enrollment_user ON user_course_enrollment(user_id);
CREATE INDEX idx_user_course_enrollment_course ON user_course_enrollment(course_id);

-- 7. ENABLE RLS
ALTER TABLE learning_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_enrollment ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES

-- learning_skills: public read access
CREATE POLICY "Learning skills are public" ON learning_skills
  FOR SELECT USING (true);

-- learning_courses: public read access
CREATE POLICY "Learning courses are public" ON learning_courses
  FOR SELECT USING (true);

-- user_learning_roadmaps: users can access own
CREATE POLICY "Users can access own learning roadmaps" ON user_learning_roadmaps
  FOR ALL USING (user_id = auth.uid());

-- user_skill_progress: users can access own
CREATE POLICY "Users can manage own skill progress" ON user_skill_progress
  FOR ALL USING (user_id = auth.uid());

-- user_course_enrollment: users can access own
CREATE POLICY "Users can manage own course enrollment" ON user_course_enrollment
  FOR ALL USING (user_id = auth.uid());

-- 9. TRIGGERS for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_learning_skills_updated_at
  BEFORE UPDATE ON learning_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_courses_updated_at
  BEFORE UPDATE ON learning_courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_learning_roadmaps_updated_at
  BEFORE UPDATE ON user_learning_roadmaps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_skill_progress_updated_at
  BEFORE UPDATE ON user_skill_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_course_enrollment_updated_at
  BEFORE UPDATE ON user_course_enrollment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. MIGRATION COMPLETE
SELECT 'Learning Roadmap Schema Migration Complete!' as message;
