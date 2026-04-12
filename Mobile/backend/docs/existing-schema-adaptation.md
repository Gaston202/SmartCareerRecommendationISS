# Adapting Backend to Existing Schema

## Changes Made

This migration (`migrations/002_adapt_to_existing_schema.sql`) adapts your existing database to work with the production backend while preserving all your data.

---

## What This Migration Does

### 1. Adds Missing Columns to Existing Tables

#### `user_quiz_sessions`
- `answers` (JSONB) - Stores array of `{question_number, answer}`
- `current_question` (INTEGER) - Tracks current question number (1-10)

#### `careers`
- `preferred_interests` (TEXT[]) - Array of interest areas
- `typical_traits` (TEXT[]) - Personality traits for matching
- `tags` (TEXT[]) - UI tags for display
- `salary_range_min` / `salary_range_max` (INTEGER) - Compensation info
- `growth_potential` (TEXT) - 'high', 'medium', 'low'
- `is_active` (BOOLEAN) - Soft delete flag

#### `cv_analysis`
- `pdf_url` (TEXT) - Supabase Storage URL for uploaded PDF
- `status` (TEXT) - 'pending'|'processing'|'completed'|'failed'
- `extracted_text` (TEXT) - Full extracted text from PDF
- `job_id` (TEXT) - BullMQ job tracking ID
- `error_message` (TEXT) - Error if failed
- `completed_at` (TIMESTAMPTZ) - When processing finished

### 2. Creates New Tables

#### `career_roadmaps`
Roadmap templates for each career (RAG source).
- Links to `careers` (one-to-one)
- Contains `milestones` JSON with tasks and resources
- Will be personalized per user

#### `user_roadmaps`
Personalized roadmaps generated for users.
- Links to `auth.users` and `career_roadmaps`
- Stores `personalized_content` JSON
- Tracks `used_at` for analytics

#### `async_jobs`
Job tracking for async operations (CV analysis, roadmap generation).
- Allows frontend to poll job status
- Stores `progress` (0-100), `error_message`, `result_url`
- Linked to user for visibility

---

## Row Level Security (RLS)

RLS enabled on new tables:
- `user_roadmaps`: Users can only access their own roadmaps
- `async_jobs`: Users can only access their own jobs
- `career_roadmaps`: Public read (anyone can view templates)

---

## Run the Migration

1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire contents of `migrations/002_adapt_to_existing_schema.sql`
3. Paste and execute

**Expected result:** All `ALTER TABLE` and `CREATE TABLE` operations should succeed without errors.

---

## Post-Migration Steps

### 1. Verify Changes

Check that new columns exist:

```sql
-- user_quiz_sessions should now have:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_quiz_sessions' 
  AND column_name IN ('answers', 'current_question');

-- careers should have all new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'careers' 
  AND column_name IN ('preferred_interests', 'typical_traits', 'tags', 'salary_range_min', 'growth_potential', 'is_active');

-- cv_analysis should have PDF fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cv_analysis' 
  AND column_name IN ('pdf_url', 'status', 'extracted_text', 'job_id');
```

### 2. Seed Career Roadmap Templates

The `career_roadmaps` table will be empty. Add templates for careers you have:

```sql
INSERT INTO career_roadmaps (career_id, title, description, milestones, total_duration_weeks) VALUES
(
  'career-uuid-here',
  'Roadmap to Becoming a Software Engineer',
  'A comprehensive 6-month plan...',
  '[
    {
      "id": "month1",
      "title": "Month 1-2: Foundation",
      "description": "Master core programming concepts...',
      "duration_weeks": 8,
      "tasks": [
        {"id": "t1", "title": "Learn JavaScript basics", "estimated_hours": 20}
      ],
      "resources": [
        {"type": "course", "title": "JS Course", "url": "https://..."}
      ]
    }
  ]'::jsonb,
  24
);
```

### 3. Update Backend Service Code

After migration, the backend services need to be updated to use your table/column names:

**Services to update:**
- `quiz/quiz.service.ts` - Map to `user_quiz_sessions` / `user_quiz_responses`
- `career/career.service.ts` - Map to your `careers` columns (category instead of title? Check structure)
- `cv/cv.service.ts` - Map to `cv_analysis` + `cvs` tables

I'll create these mappings next.

---

## What About Your `recommendations` Table?

I see you have a `recommendations` table. The backend will use `career_match_results` for detailed match data, but we could also populate `recommendations` as a denormalized view for quick access.

Would you like me to:
1. **Leave `recommendations` as-is** (backend uses separate tables)
2. **Add trigger** to auto-populate `recommendations` when `career_match_results` is created
3. **Replace** `career_match_results` with `recommendations` (simpler)

Let me know!

---

## What About `skills` Table?

You have a `skills` table with `name`, `category`, `description`, `related_careers`. The backend can:
- Use this as canonical skill list
- Reference skill IDs instead of names in `careers.required_skills`

Would you like me to:
1. Keep current approach (TEXT[] in careers)
2. Use foreign keys to `skills` table (normalized)

The TEXT[] approach is simpler and works well for now.

---

## Next Steps After Migration

1. ✅ Run migration in Supabase
2. ⏭️ I'll update backend services to match your schema
3. ⏭️ Update DTOs and database queries
4. ⏭️ Test with real data
5. ⏭️ Start backend server
6. ⏭️ Connect mobile app

---

## Rollback

If something goes wrong, all `ALTER TABLE` operations are reversible:

```sql
-- To remove added columns:
ALTER TABLE user_quiz_sessions DROP COLUMN IF EXISTS answers;
ALTER TABLE user_quiz_sessions DROP COLUMN IF EXISTS current_question;
-- etc...
```

But since we used `ADD COLUMN IF NOT EXISTS`, running again is safe.

---

## Need Help?

Post any errors from the migration and I'll fix them!
