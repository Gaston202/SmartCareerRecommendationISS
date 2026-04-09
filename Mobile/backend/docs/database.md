# Database Schema Documentation

## Tables Overview

### 1. `user_profiles`
Extended profile data for authenticated users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Primary key |
| `user_id` | UUID (FK) | References `auth.users(id)` |
| `full_name` | TEXT | User's display name |
| `avatar_url` | TEXT | Profile picture URL |
| `bio` | TEXT | Short bio |
| `location` | TEXT | City/country |
| `website` | TEXT | Personal website |
| `phone` | TEXT | Contact number |
| `preferences` | JSONB | App preferences (notifications, theme, etc.) |
| `created_at` | TIMESTAMPTZ | Record creation |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

**Indexes:** `idx_user_profiles_user_id`

**RLS Policy:** Users can access only their own profile.

---

### 2. `quiz_sessions`
Stateful quiz sessions for each user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Session ID |
| `user_id` | UUID (FK) | Owner |
| `quiz_id` | TEXT | Quiz type identifier (default: `career-fit-quiz`) |
| `status` | ENUM | `'in_progress'` or `'completed'` |
| `current_question` | INTEGER | Current question number (1-10) |
| `answers` | JSONB | Array of `{question_number, answer}` |
| `completed_at` | TIMESTAMPTZ | When quiz finished |
| `created_at` | TIMESTAMPTZ | Session start |
| `updated_at` | TIMESTAMPTZ | Auto-updated |

**Indexes:**
- `idx_quiz_sessions_user_id` (for user's sessions)
- `idx_quiz_sessions_completed` (for completed sessions by recency)
- `idx_quiz_sessions_created` (for cleanup)

**RLS Policy:** Users can access only their own sessions.

**Business Rules:**
- Keep max 5 completed sessions per user (cleanup job)
- `answers` array should have exactly 10 entries when `status = 'completed'`
- `current_question` should never exceed 11

---

### 3. `quiz_answers`
Immutable log of each answer provided.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Answer ID |
| `session_id` | UUID (FK) | Parent session |
| `question_number` | INTEGER | 1-10 |
| `question` | TEXT | The question text (snapshot at time of answering) |
| `selected_option` | TEXT | User's chosen answer label |
| `all_options` | JSONB | All options shown (for audit/replay) |
| `created_at` | TIMESTAMPTZ | When answered |

**Indexes:**
- `idx_quiz_answers_session_id`
- `idx_quiz_answers_question_number`
- **Unique:** `(session_id, question_number)` - one answer per question

**RLS Policy:** Users can access answers for sessions they own.

---

### 4. `careers`
Reference table of career options.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Career ID |
| `title` | TEXT | Career title (e.g., "Software Engineer") |
| `description` | TEXT | 2-3 sentence description |
| `required_skills` | TEXT[] | Array of skills (for matching) |
| `preferred_interests` | TEXT[] | Interest areas (for matching) |
| `typical_traits` | TEXT[] | DISC/personality traits |
| `tags` | TEXT[] | UI tags (e.g., "Technology", "Leadership") |
| `salary_range_min` | INTEGER | Annual salary (USD) |
| `salary_range_max` | INTEGER | Annual salary (USD) |
| `growth_potential` | TEXT | 'high', 'medium', 'low' |
| `is_active` | BOOLEAN | Hide deprecated careers |
| `created_at` / `updated_at` | TIMESTAMPTZ | Metadata |

**Indexes:**
- `idx_careers_active` (partial index for active careers)
- GIN indexes on `required_skills`, `preferred_interests`, `typical_traits` for array overlap queries

**Seeding:** Populate with 20-50 diverse careers across industries.

---

### 5. `career_match_results`
Computed matches for a quiz session.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Match ID |
| `user_id` | UUID (FK) | Owner |
| `quiz_session_id` | UUID (FK) | Session that generated it |
| `cv_analysis_id` | UUID (FK, nullable) | Linked CV analysis (if available) |
| `career_id` | UUID (FK) | Matched career |
| `match_score` | INTEGER (0-100) | Computed match percentage |
| `match_reasons` | TEXT[] | Deterministic reasoning (skills, interests, traits) |
| `ai_insights` | JSONB | AI-generated explanation text |
| `ranking` | INTEGER | 1-5 (top 5 only) |
| `generated_at` | TIMESTAMPTZ | When computed |

**Indexes:**
- `idx_career_match_results_user_quiz` composite for user's career matches by session
- `idx_career_match_results_career` for career popularity stats
- `idx_career_match_results_score` for high-score queries

**RLS Policy:** Users can access only their own matches.

**Business Rules:**
- Only top 5 matches stored per session
- Recompute on new CV analysis (invalidate old matches)
- Fresh matches generated when quiz completed

---

### 6. `cv_analyses`
CV upload analysis tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Analysis ID |
| `user_id` | UUID (FK) | Owner |
| `pdf_url` | TEXT | Public/signed Supabase Storage URL |
| `status` | ENUM | `'pending'` → `'processing'` → `'completed'` | `'failed'` |
| `extracted_text` | TEXT | Full text from PDF (may be truncated) |
| `extracted_data` | JSONB | Structured: `{skills[], experience[], education[], summary?}` |
| `ats_score` | INTEGER (0-100) | ATS compatibility score |
| `ats_issues` | JSONB[] | Array of issues: `{type, severity, description, fix?}` |
| `suggested_improvements` | JSONB[] | Array: `{section, suggestion, example?}` |
| `job_id` | TEXT (nullable) | BullMQ job ID for tracking |
| `error_message` | TEXT (nullable) | Error if `status = 'failed'` |
| `completed_at` | TIMESTAMPTZ (nullable) | When done |
| `created_at` / `updated_at` | TIMESTAMPTZ | Metadata |

**Indexes:**
- `idx_cv_analyses_user_id`
- `idx_cv_analyses_status` (partial for pending/processing)
- `idx_cv_analyses_created` (most recent first)

**RLS Policy:** Users can access only their own analyses.

**Storage:**
- Use Supabase Storage bucket `cv-uploads`
- Set bucket to private, generate signed URLs for server-side access
- Cleanup: Archive PDFs after 90 days (via lifecycle policy)

---

### 7. `career_roadmaps`
Roadmap templates for each career (RAG source).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Roadmap template ID |
| `career_id` | UUID (FK, UNIQUE) | One-to-one with career |
| `title` | TEXT | Roadmap title |
| `description` | TEXT | Summary |
| `milestones` | JSONB | Array of milestone objects |
| `total_duration_weeks` | INTEGER | Sum of milestone durations |
| `embedding` | VECTOR(1536) (nullable) | OpenAI embedding for similarity search |
| `created_at` / `updated_at` | TIMESTAMPTZ | Metadata |

**Milestone JSON Structure:**
```json
[
  {
    "id": "milestone_1",
    "title": "Month 1-2: Foundation",
    "description": "Build core skills...",
    "duration_weeks": 8,
    "tasks": [
      {
        "id": "task_1",
        "title": "Learn React basics",
        "description": "...",
        "estimated_hours": 20,
        "dependencies": []
      }
    ],
    "resources": [
      {
        "type": "course",
        "title": "React Course",
        "url": "https://...",
        "description": "..."
      }
    ]
  }
]
```

**Indexes:**
- `idx_career_roadmaps_career_id`
- **Vector index** (if using pgvector): `idx_career_roadmaps_embedding` with `vector_cosine_ops`

**Note:** Each career should have exactly one roadmap template. Seed with 20-50 templates.

---

### 8. `user_roadmaps`
Personalized roadmaps generated for users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record ID |
| `user_id` | UUID (FK) | Owner |
| `career_roadmap_id` | UUID (FK) | Source template |
| `personalized_content` | JSONB | Customized milestones (may differ from template) |
| `used_at` | TIMESTAMPTZ | When user viewed/downloaded |
| `created_at` | TIMESTAMPTZ | Generation time |

**Indexes:**
- `idx_user_roadmaps_user_id`
- `idx_user_roadmaps_used` (for recent roadmaps)

**RLS Policy:** Users can access only their own roadmaps.

---

### 9. `async_jobs`
Job tracking for async operations (frontend polling support).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Tracking ID |
| `user_id` | UUID (FK) | Job owner |
| `job_type` | TEXT | `'cv_analysis'`, `'roadmap_generation'`, `'bulk_upload'` |
| `job_id` | TEXT (UNIQUE) | BullMQ internal job ID (for status lookup) |
| `status` | ENUM | `'pending'`, `'active'`, `'completed'`, `'failed'`, `'delayed'` |
| `progress` | INTEGER (0-100) | Percentage |
| `result_url` | TEXT | URL to fetch result (e.g., `/cv/result/:id`) |
| `error_message` | TEXT (nullable) | Error if failed |
| `metadata` | JSONB | Additional context (file name, career ID, etc.) |
| `created_at`, `started_at`, `completed_at`, `updated_at` | TIMESTAMPTZ | Timeline |

**Indexes:**
- `idx_async_jobs_user_id` + `status` for active job queries
- `idx_async_jobs_job_id` for BullMQ reconciliation

**Use:** Frontend polls `/cv/status/:analysisId` → looks up `async_jobs` by `result_url` or direct ID.

---

### 10. `api_audit_logs`
Audit trail for all API requests.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Log entry ID |
| `user_id` | UUID (FK, nullable) | Who made the call (null for unauthenticated) |
| `method` | TEXT | HTTP method (GET, POST, etc.) |
| `path` | TEXT | URL path (without query string) |
| `status_code` | INTEGER | Response status |
| `duration_ms` | INTEGER | Request processing time |
| `request_ip` | INET | Client IP |
| `user_agent` | TEXT | User-Agent header |
| `request_body` | JSONB (nullable) | Sanitized request body (exclude PII) |
| `response_size_bytes` | INTEGER (nullable) | Response size |
| `created_at` | TIMESTAMPTZ | When logged |

**Indexes:**
- `idx_api_audit_logs_user_id` (for user's activity)
- `idx_api_audit_logs_created` (most recent first)
- `idx_api_audit_logs_path_status` (for error rate analysis)

**Retention:** 90 days (automatically delete older entries via cron).

---

## Relationships

```
auth.users (Supabase Auth)
   │
   ├── 1:N → user_profiles
   ├── 1:N → quiz_sessions
   ├── 1:N → cv_analyses
   ├── 1:N → career_match_results
   ├── 1:N → user_roadmaps
   └── 1:N → async_jobs

quiz_sessions (1) ← (N) quiz_answers

careers (1) ← (N) career_match_results
careers (1) → (1) career_roadmaps

quiz_sessions → career_match_results (via quiz_session_id)
cv_analyses → career_match_results (via cv_analysis_id)
```

---

## Views

### `user_latest_quiz_results`
Convenient view for each user's most recent completed quiz with career matches.

```sql
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
```

---

## Key Functions

### `get_nova_profile_from_answers(answers JSONB)`
Calculates DISC percentages and dominant style from quiz answers.

**Parameters:** `answers` - Array of answer labels

**Returns:** `JSONB` with `{disc_percentages, dominant_style}`

**Implementation:** (placeholder - replicate frontend logic)

---

## Triggers

All tables with `updated_at` columns have `BEFORE UPDATE` triggers that auto-set `NEW.updated_at = NOW()`.

---

## Row Level Security (RLS)

RLS enabled on all user-owned tables. Policies enforce isolation: users can only CRUD their own records.

**Important:** Service layer (`supabase.service_role`) is used by backend to bypass RLS for admin queries (e.g., cleanup jobs). Never expose service role key to client.

---

## Migration Instructions

1. Open Supabase Dashboard → Project → SQL Editor
2. Paste contents of `migrations/001_initial_schema.sql`
3. Execute (may take 10-15 seconds due to indexes)
4. Verify tables created: `SELECT * FROM information_schema.tables WHERE table_schema = 'public';`
5. Insert seed careers if not already included:

```sql
INSERT INTO careers (...) VALUES (...);
-- (Already in migration script)
```

6. Create Storage bucket for CV uploads:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('cv-uploads', 'cv-uploads', false);
```

7. Then in Supabase Storage UI, set RLS policies (see migration script comments).

---

## Performance Considerations

### Indexes
- All foreign keys indexed
- Composite indexes for common query patterns
- GIN indexes for array overlap queries (` careers.required_skills && userSkills`)
- Partial indexes for active records only

### Query Patterns
- Fetching user's latest quiz: `WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`
- Fetching career matches: `WHERE quiz_session_id = $1 ORDER BY ranking` (use unique constraint)
- CV analysis: `WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`

### Partitioning (Future)
For high-scale deployments (>1M rows), consider:
- Partitioning `api_audit_logs` by `created_at` (monthly)
- Partitioning `quiz_answers` by `quiz_session_id` hash

---

## Backup & Restore

Supabase provides automatic daily backups with PITR (point-in-time recovery).

**Manual Backup:**
```bash
pg_dump -h your-db.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

**Restore:** Use Supabase Dashboard → Project Settings → Database → Restore.

---

## Monitoring Queries

Check for slow queries:
```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

Queue depth:
```sql
SELECT status, COUNT(*) FROM async_jobs WHERE status IN ('pending', 'active') GROUP BY status;
```

Failed CV analyses:
```sql
SELECT * FROM cv_analyses WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20;
```

---

## Future Enhancements

1. **Vector embeddings** for roadmaps (pgvector) - enable similarity search
2. **Materialized views** for common aggregations (user stats)
3. **Partitioning** for large tables (by date or user hash)
4. **Full-text search** on careers (title, description, tags)
5. **Materialized path** for career hierarchies (parent/child careers)
