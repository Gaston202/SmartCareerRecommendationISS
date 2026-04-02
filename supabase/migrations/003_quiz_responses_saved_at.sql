-- Add saved_at column to user_quiz_responses table
-- This column tracks when quiz answers are saved to Supabase

ALTER TABLE user_quiz_responses ADD COLUMN IF NOT EXISTS saved_at timestamptz DEFAULT now();

-- Optional: Create index for faster queries on saved_at
CREATE INDEX IF NOT EXISTS user_quiz_responses_saved_at_idx ON user_quiz_responses(saved_at DESC);
