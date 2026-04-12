# Career Recommendation System - Hybrid Architecture

## Overview

This system implements a **hybrid career recommendation engine** that combines:

- **Deterministic scoring** (80% of decision weight) - rule-based, transparent, reproducible
- **AI-generated explanations** (20% of decision weight) - natural language personalization only

**Key Principle**: AI is used ONLY for generating human-friendly explanations. The ranking and matching scores are computed **entirely deterministically** to ensure fairness, transparency, and auditability.

---

## System Architecture

### 1. Deterministic Scoring Engine (`career.service.ts:calculateMatch`)

The core matching algorithm calculates a **0-100 match score** based on three weighted components:

#### Skill Match (40% weight)

- Compares user's confirmed skills (from CV) with career required_skills
- Uses substring matching for flexibility (e.g., "JavaScript" matches "JavaScript/TypeScript")
- Formula: `(matched_skills / total_required_skills) * 40`

#### Interest Match (30% weight)

- Compares user's interests (from CV or inferred) with career preferred_interests
- Uses the same substring overlap logic
- Formula: `(matched_interests / total_preferred_interests) * 30`

#### Trait Match from Quiz (30% weight)

- Analyzes quiz answers to extract work preference traits
- Enhanced trait mapping with 30+ keyword patterns across 4 dimensions:
  - **Leadership/Decisive** (red): lead, direct, decide, action, competitive, results
  - **Analytical/Detail** (blue): analyze, data, detail, precision, structure, quality
  - **Team/Support** (green): team, support, collaborate, help, empathy, relationships
  - **Creative/Innovative** (yellow): creative, ideas, innovate, flexible, experiment, vision
- Each career has typical_traits (from database) that are matched against extracted user traits
- Uses weighted relevance scoring (1.0 for exact matches, 0.6-0.9 for related)

#### Final Score

```
total_score = skill_score + interest_score + trait_score
final_score = min(round(total_score), 100)
```

### 2. Career Database Schema

The `careers` table stores reference careers with:

- `required_skills` (TEXT[]) - skills needed for the role
- `preferred_interests` (TEXT[]) - interests that align with the career
- `typical_traits` (TEXT[]) - personality/work style traits that fit well
- `tags`, `salary_range_min/max`, `growth_potential`, etc.

**Sample career entry**:

```sql
INSERT INTO careers VALUES (
  'Software Engineer',
  'Design, build, and maintain robust technical solutions.',
  ARRAY['JavaScript', 'Python', 'React', 'Node.js', 'SQL'],
  ARRAY['Technology', 'Innovation', 'Problem Solving', 'Continuous Learning'],
  ARRAY['Analytical', 'Detail-oriented', 'Independent', 'Logical'],
  ...
);
```

### 3. AI Enhancement Layer (`aiOrchestrator.generateCareerExplanation`)

**Purpose**: Generate natural, personalized explanations for why each career is a good match.

**Input**:

- Career details (title, description, required_skills)
- User's quiz answers (top 3)
- User's confirmed CV skills
- Computed DISC profile percentages (from quiz answers)
- Deterministic match score and reasons

**Output**: 2-3 sentence explanation (~100-150 chars) like:

> "Based on your profile, your analytical skills and preference for structured work align perfectly with software engineering. Your JavaScript experience directly matches a key requirement, and your quiz responses show strong attention to detail."

**Critical**: AI does **NOT** decide the ranking. It only explains results.

### 4. Storage in Supabase

Results are stored in `career_match_results`:

```typescript
interface CareerMatchResult {
  user_id: string;
  quiz_session_id: string;
  cv_analysis_id: string | null;
  career_id: string;
  match_score: integer; // 0-100, from deterministic engine
  match_reasons: string[]; // e.g., ["Skills matched: JavaScript, React", "Interests aligned: Technology"]
  ai_insights: {
    explanation: string; // AI-generated explanation
    status: "pending" | "completed";
  };
  ranking: integer; // 1-5 (top 5 only)
  generated_at: timestamp;
}
```

**Two-phase save**:

1. **Preliminary**: Save deterministic matches with `ai_insights.explanation = null, status = 'pending'`
2. **Final**: Update with AI-generated explanation and `status = 'completed'`

This ensures users see results even if AI fails (fallback explanation used).

---

## Data Flow

```
User completes Quiz + (optional) CV upload
         ↓
API: POST /career/recommend { quiz_session_id, cv_analysis_id? }
         ↓
Backend: CareerService.getCareerRecommendations()
         ├─ Fetch quiz answers from user_quiz_responses
         ├─ Fetch CV skills from cv_analysis (if provided)
         ├─ Fetch all active careers from careers table
         ├─ Calculate deterministic matches (top 5)
         ├─ Save preliminary results (status: pending)
         ├─ Generate AI explanations (parallel, with fallback)
         ├─ Update records with AI explanations (status: completed)
         └─ Cache results (6 hours)
         ↓
Return: [{ career, score, matchReasons, aiExplanation }]
```

---

## API Endpoints

### POST `/career/recommend`

Request:

```json
{
  "quiz_session_id": "uuid",
  "cv_analysis_id": "uuid" // optional
}
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "career": {
        /* Career object */
      },
      "match_score": 92,
      "match_reasons": ["Skills matched: JavaScript, React", "..."],
      "ai_explanation": "Based on your profile..."
    }
  ]
}
```

### GET `/career/all`

Returns all reference careers (for admin/development).

---

## Database Schema

### Key Tables

#### `careers`

Reference data - manually curated careers with required skills, interests, traits.

#### `career_match_results`

User-specific match results (read-only for users, RLS protected).

#### `user_quiz_responses`

Stores each quiz answer (question_number, selected_option).

#### `cv_analyses`

CV processing pipeline (async):

- `extracted_skills` - TEXT[] array (populated by worker)
- `extracted_interests` - TEXT[] array (populated by worker)
- `extracted_data` - JSONB with full structured data
- `ats_score` - 0-100Applicant Tracking System score

---

## Configuration

### Environment Variables

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENROUTER_API_KEY=...
OPENROUTER_URL=https://openrouter.ai/api/v1/chat/completions
```

### AI Models (OpenRouter)

- Primary: `stepfun/step-3.5-flash:free` (fast, reliable)
- Fallback: `arcee-ai/trinity-large-preview:free`

Used only for explanation generation.

---

## Why Hybrid Approach?

| Aspect              | Deterministic Engine                                  | AI-Only Approach            |
| ------------------- | ----------------------------------------------------- | --------------------------- |
| **Transparency**    | ✅ Clear scoring logic, auditable                     | ❌ Black box, hard to debug |
| **Consistency**     | ✅ Same input → same output                           | ❌ Non-deterministic        |
| **Performance**     | ✅ Fast, no external calls                            | ❌ Slow, API-dependent      |
| **Bias Control**    | ✅ Rules explicitly defined                           | ❌ Hidden biases possible   |
| **Personalization** | ⚠️ Limited to rule templates                          | ✅ Rich natural language    |
| **Best of both**    | ✅ **We get score reliability + explanation quality** |                             |

**Conclusion**: The hybrid approach gives you trustworthy rankings with engaging, personalized explanations.

---

## Testing the System

### 1. Verify Deterministic Scoring

```typescript
// Mock data
const careers = await careerService.getAllCareers();
const matches = await careerService.calculateMatch(
  ["I enjoy leading teams", "I prefer analyzing data carefully"], // quiz answers
  ["JavaScript", "React"], // user skills
  ["Technology", "Problem Solving"], // user interests
);
// Assert scores are reproducible and rank order makes sense
```

### 2. Verify AI Explanations

```typescript
const enhanced = await careerService.enhanceMatchesWithAi(
  matches,
  quizAnswers,
  skills,
);
// Each match.ai_explanation should be non-empty, personalized string
```

### 3. End-to-End API Test

```bash
# 1. Complete a quiz (frontend)
# 2. Upload CV (optional)
# 3. Call POST /career/recommend
# 4. Verify response has 5 careers with scores + explanations
# 5. Check Supabase: career_match_results table populated
```

---

## Troubleshooting

### Issue: "No careers returned"

- Check `careers` table has `is_active = true` records
- Run migrations: `npm run migrate`
- Seed data: `npm run seed:careers`

### Issue: "Low match scores across board"

- Verify user skills/interests are being extracted from CV correctly
- Check quiz answers are saved to `user_quiz_responses`
- Log `traceId` to debug specific user session

### Issue: "AI explanations are generic"

- Check OpenRouter API key is valid
- Review prompt in `ai-orchestrator.service.ts:buildSystemPrompt()`
- Ensure `quizAnswers` and `cvSkills` are passed to AI

### Issue: "Schema mismatch errors"

- Run all migrations in order: `001_initial_schema.sql` → `004_add_cv_columns.sql`
- Check Supabase Dashboard > Table Editor for column existence

---

## Future Enhancements

1. **Trait Matching**: Add more granular quiz answer → trait mappings
2. **Skill Graph**: Implement skill similarity (e.g., "React" → "Frontend Development" → "JavaScript")
3. **Feedback Loop**: Store user feedback on matches to refine weights
4. **A/B Testing**: Test different weightings (40/30/30 vs 50/30/20)
5. **Explainable AI**: Include which quiz answers contributed to each match

---

## References

- Backend: `Mobile/backend/src/modules/career/`
- Frontend: `Mobile/src/features/careers/`
- Migrations: `Mobile/backend/migrations/`
- AI Orchestrator: `Mobile/backend/src/core/ai-orchestrator/`
