# Quick Start: Hybrid Career Recommendation System

## 🚀 Running the System

### 1. Setup Database

```bash
cd Mobile/backend

# Run migrations in order (via Supabase Dashboard or CLI)
# 001_initial_schema.sql
# 003_data_migration_for_careers.sql
# 004_add_cv_columns.sql  ← NEW
# 005_fix_table_names.sql ← NEW

# Or use Supabase CLI:
npx supabase db reset  # (destructive, for fresh start)
```

### 2. Install Dependencies

```bash
cd Mobile/backend
npm install
```

### 3. Set Environment Variables

```env
SUPABASE_URL=your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
OPENROUTER_API_KEY=sk-or-v1-...
REDIS_URL=redis://localhost:6379
```

### 4. Start Backend

```bash
npm run start:dev
# API available at http://localhost:3000/api/v1
```

### 5. Test Endpoint

```bash
curl -X POST http://localhost:3000/api/v1/career/recommend \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quiz_session_id":"uuid-here","cv_analysis_id":"uuid-optional"}'
```

---

## 📊 How It Works (TL;DR)

```
User Quiz + CV → [Deterministic Engine] → Top 5 Ranked Careers
                           ↓
                    [AI Only] → Personalized Explanations
                           ↓
                  Store in Supabase + Cache
```

**Deterministic (80%)**:

- Skills overlap → 40%
- Interests overlap → 30%
- Trait matching from quiz → 30%

**AI (20% role)**: ONLY generates natural language explanations, does not affect scores.

---

## 🔍 Debugging

### Check Logs

Look for trace ID pattern: `rec:${userId}:${quizSessionId.slice(0,8)}`

Example:

```
[rec:abc12345] Starting career recommendation pipeline
[rec:abc12345] Computed 5 matches: Software Engineer(92%), Product Manager(85%)
[rec:abc12345] Pipeline completed successfully
```

### Verify Database Records

```sql
-- Check careers
SELECT id, title, required_skills FROM careers WHERE is_active = true;

-- Check match results for user
SELECT
  c.title,
  cmr.match_score,
  cmr.match_reasons,
  cmr.ai_insights->'explanation' as explanation,
  cmr.ranking
FROM career_match_results cmr
JOIN careers c ON c.id = cmr.career_id
WHERE cmr.user_id = 'user-uuid'
ORDER BY cmr.ranking;

-- Check quiz responses
SELECT question_number, selected_option
FROM user_quiz_responses
WHERE session_id = 'session-uuid'
ORDER BY question_number;
```

---

## 📁 Key Files

| File                                 | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| `career.service.ts`                  | Deterministic engine + AI coordination |
| `ai-orchestrator.service.ts`         | Explanation generation (OpenRouter)    |
| `migrations/004_add_cv_columns.sql`  | Adds missing cv_analysis columns       |
| `migrations/005_fix_table_names.sql` | Renames quiz tables to match code      |
| `CAREER_RECOMMENDATION_SYSTEM.md`    | Full architecture docs                 |
| `IMPLEMENTATION_SUMMARY.md`          | Change log & rationale                 |

---

## ⚠️ Known Issues & Fixes

### Issue: "Column extracted_skills does not exist"

**Fix**: Run migration 004:

```sql
-- Add columns manually if needed
ALTER TABLE cv_analyses
  ADD COLUMN IF NOT EXISTS extracted_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted_interests TEXT[] DEFAULT '{}';
```

### Issue: "Relation user_quiz_responses does not exist"

**Fix**: Run migration 005 to rename tables:

```sql
-- The migration renames quiz_answers → user_quiz_responses
-- and quiz_sessions → user_quiz_sessions
```

### Issue: "AI explanations are blank"

**Check**:

1. `OPENROUTER_API_KEY` is set and valid
2. OpenRouter account has credits
3. Check backend logs for AI errors
4. Fallback message should appear: `"Strong 92% match based on your skills..."`

---

## ✅ Verification Checklist

- [ ] Migrations 001-005 applied (check via Supabase SQL editor)
- [ ] `careers` table has ≥ 5 active careers
- [ ] Backend starts without TypeScript errors
- [ ] POST `/career/recommend` returns 200 with 5 matches
- [ ] Each match has non-null `ai_explanation`
- [ ] `career_match_results` table populated with `ai_insights->>'status' = 'completed'`
- [ ] Logs show trace IDs and DISC profile percentages

---

## 🧮 Example Scoring Walkthrough

**User Profile**:

- Skills: ["JavaScript", "React", "Node.js"]
- Interests: ["Technology", "Problem Solving"]
- Quiz answers: ["I prefer leading teams", "I enjoy analyzing data carefully", "I value creative freedom"]

**Career**: Software Engineer

- Required skills: ["JavaScript", "React", "Node.js", "Python", "SQL"]
- Preferred interests: ["Technology", "Innovation", "Problem Solving"]
- Typical traits: ["Analytical", "Detail-oriented", "Independent"]

**Scoring**:

1. Skills: 3/5 matched → (3/5)\*40 = 24
2. Interests: 2/3 matched → (2/3)\*30 = 20
3. Traits: Quiz shows "analyzing data" → matches "Analytical" → weighted score ~22
4. Total: 24+20+22 = 66 → 66% match

**AI Explanation** (via OpenRouter):

> "Based on your profile, your JavaScript and React skills align perfectly with this role. Your analytical approach and enjoyment of problem-solving match the core traits of successful software engineers."

---

## 🎯 Next Steps

1. **Add more careers**: Seed `careers` table with diverse roles
2. **Refine trait patterns**: Expand keyword dictionaries in `calculateTraitScoreFromQuiz()`
3. **Add skill similarity**: Map "React" → "Frontend" → "JavaScript ecosystem"
4. **User feedback**: Store thumbs up/down on explanations to improve AI prompts
5. **A/B test weights**: Experiment with 50/30/20 vs 40/30/30 splits

---

**Last Updated**: Implementation completed  
**Status**: ✅ Deterministic engine + AI explanations operational  
**AI Role**: Explanation-only (no ranking influence)
