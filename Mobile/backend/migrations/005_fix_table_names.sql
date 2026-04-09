-- =============================================
-- FIX TABLE NAMING: Rename to match codebase convention
-- Code expects: user_quiz_sessions, user_quiz_responses
-- Original schema used: quiz_sessions, quiz_answers
-- =============================================

-- Rename quiz_sessions to user_quiz_sessions
DO $$ 
DECLARE
  fk_name text;
BEGIN
  -- Drop foreign key constraints first
  SELECT constraint_name INTO fk_name 
  FROM information_schema.table_constraints 
  WHERE table_name = 'career_match_results' 
    AND constraint_type = 'FOREIGN KEY' 
    AND constraint_name LIKE '%quiz_session_id%';
  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE career_match_results DROP CONSTRAINT ' || fk_name;
  END IF;
  
  -- Drop constraint on user_quiz_responses (will be recreated after rename)
  SELECT constraint_name INTO fk_name 
  FROM information_schema.table_constraints 
  WHERE table_name = 'quiz_answers' 
    AND constraint_type = 'FOREIGN KEY';
  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE quiz_answers DROP CONSTRAINT ' || fk_name;
  END IF;
  
  -- Rename tables
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quiz_sessions') THEN
    ALTER TABLE quiz_sessions RENAME TO user_quiz_sessions;
    RAISE NOTICE 'Renamed quiz_sessions → user_quiz_sessions';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quiz_answers') THEN
    ALTER TABLE quiz_answers RENAME TO user_quiz_responses;
    RAISE NOTICE 'Renamed quiz_answers → user_quiz_responses';
  END IF;
  
  -- Recreate foreign key from user_quiz_responses → user_quiz_sessions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_quiz_responses') AND
     EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_quiz_sessions') THEN
    ALTER TABLE user_quiz_responses
      ADD CONSTRAINT user_quiz_responses_session_id_fkey 
      FOREIGN KEY (session_id) REFERENCES user_quiz_sessions(id) ON DELETE CASCADE;
  END IF;
  
  -- Recreate foreign key from career_match_results → user_quiz_sessions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'career_match_results') AND
     EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_quiz_sessions') THEN
    ALTER TABLE career_match_results 
      ADD CONSTRAINT career_match_results_quiz_session_id_fkey 
      FOREIGN KEY (quiz_session_id) REFERENCES user_quiz_sessions(id) ON DELETE CASCADE;
  END IF;
  
  -- Recreate indexes (drop old ones first)
  DROP INDEX IF EXISTS idx_quiz_answers_session_id;
  DROP INDEX IF EXISTS idx_quiz_answers_question_number;
  DROP INDEX IF EXISTS idx_quiz_answers_unique;
  
  CREATE INDEX IF NOT EXISTS idx_user_quiz_responses_session_id ON user_quiz_responses(session_id);
  CREATE INDEX IF NOT EXISTS idx_user_quiz_responses_question_number ON user_quiz_responses(session_id, question_number);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quiz_responses_unique ON user_quiz_responses(session_id, question_number);
  
  -- Update RLS policies that reference old table names
  -- Drop old policies on quiz_answers (now user_quiz_responses)
  DROP POLICY IF EXISTS "Users can view own quiz answers" ON quiz_answers;
  DROP POLICY IF EXISTS "Users can view own quiz answers" ON user_quiz_responses;
  
  -- Recreate policy on user_quiz_responses (using new table name)
  CREATE POLICY "Users can view own quiz answers" ON user_quiz_responses
    FOR ALL USING (
      session_id IN (
        SELECT id FROM user_quiz_sessions WHERE user_id = auth.uid()
      )
    );
  
  -- Update view (drop and recreate)
  DROP VIEW IF EXISTS user_latest_quiz_results;
  
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
  FROM user_quiz_sessions qs
  LEFT JOIN career_match_results cmr ON cmr.quiz_session_id = qs.id
  LEFT JOIN careers c ON c.id = cmr.career_id
  WHERE qs.status = 'completed'
  GROUP BY qs.user_id, qs.id, qs.completed_at;
  
  RAISE NOTICE 'Schema renamed and constraints/policies updated successfully';
END $$;

-- Ensure user_quiz_sessions has correct column types
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_quiz_sessions') THEN
    ALTER TABLE user_quiz_sessions 
      ALTER COLUMN answers TYPE JSONB USING answers::JSONB;
  END IF;
END $$;

-- Final verification
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('user_quiz_sessions', 'user_quiz_responses', 'career_match_results')
ORDER BY table_name, ordinal_position;

