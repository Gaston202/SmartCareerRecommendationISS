# Schema Mapping Guide

## Your Existing Tables vs Backend Expectations

### Quiz Module

| Expected Column | Your Table Column | Status | Notes |
|-----------------|-------------------|--------|-------|
| `quiz_sessions.id` | `user_quiz_sessions.id` | ✅ | Same |
| `quiz_sessions.user_id` | `user_quiz_sessions.user_id` | ✅ | Same |
| `quiz_sessions.quiz_id` | `user_quiz_sessions.quiz_id` | ✅ | Same |
| `quiz_sessions.status` | `user_quiz_sessions.status` | ✅ | Same |
| `quiz_sessions.current_question` | `user_quiz_sessions.current_question` | ⬆️ | **Added by migration** |
| `quiz_sessions.answers` | `user_quiz_sessions.answers` | ⬆️ | **Added by migration** (JSONB) |
| `quiz_sessions.completed_at` | `user_quiz_sessions.completed_at` | ✅ | Same |
| `quiz_answers.session_id` | `user_quiz_responses.session_id` | ✅ | Same |
| `quiz_answers.question_number` | `user_quiz_responses.question_number` | ✅ | Same |
| `quiz_answers.question` | `user_quiz_responses.question` | ✅ | Same (text) |
| `quiz_answers.selected_option` | `user_quiz_responses.selected_option` | ✅ | Same |
| `quiz_answers.all_options` | `user_quiz_responses.all_options` | ✅ | Same (JSONB) |

**No code changes needed** - backend already uses your table names!

---

### Career Module

| Expected Column | Your Table Column | Status | Notes |
|-----------------|-------------------|--------|-------|
| `careers.id` | `careers.id` | ✅ | Same |
| `careers.title` | `careers.title` | ✅ | Same |
| `careers.description` | `careers.description` | ✅ | Same |
| `careers.required_skills` | `careers.required_skills` | ✅ | Same (TEXT[]) |
| `careers.preferred_interests` | `careers.preferred_interests` | ⬆️ | **Added by migration** (populated from `category` + `demand_level`) |
| `careers.typical_traits` | `careers.typical_traits` | ⬆️ | **Added by migration** (populated from `demand_level`, `growth_rate`) |
| `careers.tags` | `careers.tags` | ⬆️ | **Added by migration** (populated from `category`, `demand_level`) |
| `careers.salary_range_min` | `careers.salary_range_min` | ⬆️ | **Added by migration** (calculated from `average_salary * 0.9`) |
| `careers.salary_range_max` | `careers.salary_range_max` | ⬆️ | **Added by migration** (calculated from `average_salary * 1.1`) |
| `careers.growth_potential` | `careers.growth_potential` | ⬆️ | **Added by migration** (derived from `growth_rate` as 'high'/'medium'/'low') |
| `careers.is_active` | `careers.is_active` | ⬆️ | **Added by migration** (default true) |

**Backend adaptation:** `career.service.adapted.ts` uses your existing columns (`category`, `average_salary`, `growth_rate`, `demand_level`) to infer the missing ones at runtime. So you don't strictly need to run the data migration, but it's recommended for consistency.

---

### CV Module

| Expected Column | Your Table Column | Status | Notes |
|-----------------|-------------------|--------|-------|
| `cv_analyses.id` | `cv_analysis.id` | ✅ | Same |
| `cv_analyses.user_id` | `cv_analysis.user_id` | ✅ | Same |
| `cv_analyses.pdf_url` | `cv_analysis.pdf_url` | ⬆️ | **Added by migration** |
| `cv_analyses.status` | `cv_analysis.status` | ⬆️ | **Added by migration** (ENUM) |
| `cv_analyses.extracted_text` | `cv_analysis.extracted_text` | ⬆️ | **Added by migration** |
| `cv_analyses.extracted_data` | `cv_analysis` - structure differs | ⚠️ | We'll use your `extracted_skills` and `extracted_interests` columns |
| `cv_analyses.ats_score` | `cv_analysis.ats_score` | ✅ | Same |
| `cv_analyses.ats_issues` | `cv_analysis.ats_issues` | ✅ | Same (JSONB) |
| `cv_analyses.suggested_improvements` | `cv_analysis.suggested_improvements` | ✅ | Same (JSONB) |
| `cv_analyses.job_id` | `cv_analysis.job_id` | ⬆️ | **Added by migration** (for queue tracking) |
| `cv_analyses.error_message` | `cv_analysis.error_message` | ⬆️ | **Added by migration** |
| `cv_analyses.completed_at` | `cv_analysis.completed_at` | ⬆️ | **Added by migration** |

**Adaptation:** The CV service reads `extracted_skills` and `extracted_interests` from your table (not `extracted_data` JSONB). This is fine - your schema is actually more normalized.

---

### New Tables to Create

| Table | Purpose | Will be Created |
|-------|---------|-----------------|
| `career_roadmaps` | Roadmap templates (one per career) | ✅ In migration 002 |
| `user_roadmaps` | Personalized roadmaps per user | ✅ In migration 002 |
| `async_jobs` | Async job tracking for polling | ✅ In migration 002 |
| `api_audit_logs` | API request logging (optional) | Skip for now |

---

## Migrations Order

Run these in order:

1. **002_adapt_to_existing_schema.sql** - Adds missing columns + creates new tables
2. **003_data_migration_for_careers.sql** - Populates new columns in `careers` from existing data
3. **004_seed_roadmap_templates.sql** - Inserts roadmap templates for each career (optional but recommended)

---

## Service Files to Use

Since you have existing tables with different names, use these adapted service files:

- `src/modules/quiz/quiz.service.adapted.ts` - Works with `user_quiz_sessions` / `user_quiz_responses`
- `src/modules/career/career.service.adapted.ts` - Works with your `careers` columns
- `src/modules/cv/cv.service.adapted.ts` - Works with `cv_analysis` (your columns)

**Replace** the original `quiz.service.ts`, `career.service.ts`, `cv.service.ts` with the `.adapted.ts` versions after renaming them.

---

## Column Mapping Logic

### Careers Table Inferred Fields

The adapted career service calculates:

1. **`preferred_interests`** = `[category, demand_level + ' Demand', 'Professional Development']`
2. **`typical_traits`** = derived from `demand_level` and `growth_rate`:
   - High demand → 'Dynamic', 'Fast-paced'
   - Medium demand → 'Stable', 'Balanced'
   - Low demand → 'Niche', 'Specialized'
   - High growth → 'Growth-oriented', 'Evolving'
   - Low growth → 'Mature', 'Stable'
3. **`tags`** = `[category, demand_level + ' Demand', growth_potential + ' Growth']`
4. **`salary_range_min/max`** = `average_salary * 0.9` and `average_salary * 1.1`
5. **`growth_potential`** = `'high'` if `growth_rate >= 20`, `'medium'` if `>= 10`, `'low'` otherwise

This means you don't need to manually populate these - the backend computes them on-the-fly from your existing data!

---

## Summary

**You have two options:**

### Option 1: Run Full Migration (Recommended)
- Execute migrations 002, 003, 004
- Backend uses the `.adapted.ts` services
- Data in new columns is persisted (can be queried directly)

### Option 2: Compute on-the-Fly (No Data Migration)
- Only run migration 002 to add columns (but don't populate)
- Backend's `career.service.adapted.ts` computes `preferred_interests`, `typical_traits`, `tags`, `salary_*`, `growth_potential` dynamically from existing `category`, `demand_level`, `average_salary`, `growth_rate`
- No data duplication, but extra computation on each request
- **Simpler** - just add the columns, no need to populate

I recommend **Option 2** for simplicity - the backend already has the logic to compute these from your existing columns. Just add the columns (migration 002) and use the adapted services.
