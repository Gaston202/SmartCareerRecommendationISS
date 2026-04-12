# Smart Career Recommendation - Production AI Backend

This is the **backend service** for the Smart Career Recommendation mobile app. It implements a production-grade AI architecture using **NestJS**, **Supabase**, **Redis**, and **OpenRouter**.

---

## Architecture Overview

```
┌─────────────────┐
│  React Native   │
│   Mobile App    │
└────────┬────────┘
         │ HTTPS (Bearer Token)
         ▼
    ┌───────┐
    │ Backend│  NestJS API Server
    │NestJS │  + AI Orchestration
    └───┬───┘
        │
        ├─────────────┬─────────────┬──────────────┐
        ▼             ▼             ▼              ▼
    ┌───────┐   ┌───────┐   ┌─────────┐   ┌─────────┐
    │Supabase│  │  Redis │   │OpenRouter│  │  BullMQ │
    │ Postgres│ │ (Cache)│  │   AI    │  │ (Queue) │
    └───────┘   └───────┘   └─────────┘   └─────────┘
```

---

## Core Components

### 1. AI Orchestration Layer (`src/core/ai-orchestrator/`)
Centralized AI management:
- **Prompt Registry**: Manages prompts for all use cases
- **OpenRouter Service**: Multi-model failover with retry logic
- **Structured Validation**: Zod schemas enforce JSON output
- **Caching**: Reduces AI costs and latency

**Supported AI Tasks:**
- Quiz question generation
- Quiz results (Nova profile + careers)
- CV analysis (structured extraction)
- CV suggestions (ATS improvements)
- Roadmap personalization (RAG)

---

### 2. Quiz Module (`src/modules/quiz/`)
Stateful 10-question adaptive quiz.

**Endpoints:**
- `POST /quiz/start` - Create session, return Q1
- `POST /quiz/answer` - Submit answer, get next Q or results
- `GET /quiz/result/:sessionId` - Fetch final results
- `GET /quiz/history` - Past quiz sessions

**Features:**
- Session persistence (Supabase)
- Redis caching (24h TTL)
- State machine (in_progress → completed)
- Fallback to static questions if AI fails

---

### 3. Career Module (`src/modules/career/`)
**Hybrid recommendation** (AI + deterministic scoring).

**Algorithm:**
1. Deterministic score based on:
   - Skill overlap (40%)
   - Interest alignment (30%)
   - Quiz traits (30%)
2. AI generates personalized explanations

**Endpoints:**
- `POST /career/recommend` - Get top 5 matches
- `GET / career/all` - Reference data

---

### 4. CV Analysis Module (`src/modules/cv/`)
Async pipeline for CV processing.

**Pipeline:**
```
Upload PDF → Storage → Queue Job →
  1. Extract text (PDF parser)
  2. AI analyzes content
  3. Calculate ATS score
  4. Generate suggestions
  5. Store in DB → Realtime notify
```

**Endpoints:**
- `POST /cv/upload` - Upload PDF (multipart)
- `GET /cv/result/:id` - Fetch analysis
- `GET /cv/result/latest` - Latest for user
- `GET /cv/status/:id` - Polling status

**Statuses:** `pending` → `processing` → `completed` / `failed`

---

### 5. Roadmap Module (`src/modules/roadmap/`)
RAG-based roadmap personalization.

**Sources:**
- Base templates from `career_roadmaps` table
- AI personalizes based on user profile (skills + quiz + CV)

**Endpoints:**
- `POST /roadmap/generate` - Generate (sync or async)
- `GET /roadmap/career/:careerId` - Fetch cached roadmap
- `GET /roadmap/status/:jobId` - Async job status

---

### 6. Auth Module (`src/modules/auth/`)
Supabase JWT validation.

- Validates JWT tokens from Supabase Auth
- Provides JWT guard for all endpoints
- User profile CRUD

---

## Database Schema

See `migrations/001_initial_schema.sql`.

### Key Tables
| Table | Purpose |
|-------|---------|
| `quiz_sessions` | Quiz session state (user_id, status, current_question) |
| `quiz_answers` | Individual answers (linked to session) |
| `careers` | Reference data (skills, traits, salary ranges) |
| `career_match_results` | Computed matches (with AI insights) |
| `cv_analyses` | CV analysis results + status |
| `career_roadmaps` | Roadmap templates (milestones JSON) |
| `user_roadmaps` | Personalized roadmaps |
| `async_jobs` | Job tracking for polling |

**RLS:** All user tables have Row Level Security (users access own data only).

---

## Caching Strategy

Redis is used for:
- Quiz questions (1h TTL)
- Quiz results (24h TTL)
- Career matches (6h TTL)
- Roadmaps (12h TTL)
- CV analysis (24h TTL)

**Keys:**
- `quiz:session:{sessionId}`
- `quiz:results:{userId}:{sessionId}`
- `career:matches:{userId}:{cvId}:{quizId}`
- `roadmap:{userId}:{careerId}`
- `cv:analysis:{userId}`

Cache-aside pattern: Read through, write through on mutations.

---

## Queue System (BullMQ)

**Queues:**
- `cv-analysis` - CV processing pipeline
- `ai-processing` - Heavy AI tasks
- `roadmap-generation` - Async roadmap generation

**Job Tracking:** `async_jobs` table stores status for frontend polling.

**Retry Policy:**
- Max 3 attempts
- Exponential backoff
- Delayed jobs on failure

---

## API Documentation

Full API spec: [`docs/api.md`](./docs/api.md)

### Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/quiz/start` | POST | Start quiz |
| `/quiz/answer` | POST | Submit answer |
| `/quiz/result/:id` | GET | Get results |
| `/career/recommend` | POST | Get career matches |
| `/cv/upload` | POST | Upload CV PDF |
| `/cv/result/:id` | GET | Get CV analysis |
| `/roadmap/generate` | POST | Generate roadmap |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker Compose (for local Postgres + Redis)
- Supabase project
- OpenRouter API key

### Setup

1. **Clone & Install**
```bash
cd backend
npm install
```

2. **Start Local Services**
```bash
docker-compose up -d
# Postgres: localhost:5432
# Redis: localhost:6379
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Run Database Migration**
```bash
# In Supabase SQL console, paste contents of:
# migrations/001_initial_schema.sql
```

5. **Development**
```bash
npm run start:dev
# API running on http://localhost:3000
# Swagger docs: http://localhost:3000/api/docs
```

---

## Deployment

### Vercel / Railway / ECS

Build with Dockerfile or `npm run build`.

**Required Environment Vars:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `REDIS_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`

### Scaling Considerations

- **Stateless API**: Deploy multiple instances behind load balancer
- **Redis**: Shared cache across instances
- **Database**: Supabase handles scaling, add read replicas if needed
- **Queue Workers**: Deploy separate worker processes (`npm run worker:cv`, `npm run worker:ai`)
- **Rate Limiting**: Add at load balancer or API gateway

---

## Mobile App Migration

### Changes Needed

1. **Replace direct OpenRouter calls** with backend endpoints:
   - Quiz: `/quiz/start`, `/quiz/answer`
   - Career: `/career/recommend`
   - CV: `/cv/upload`, `/cv/result`
   - Roadmap: `/roadmap/generate`

2. **Add JWT header** to all requests:
```javascript
headers: {
  Authorization: `Bearer ${supabaseJwt}`,
  'X-Session-Id': quizSessionId, // for quiz/answer
}
```

3. **Implement CV polling** (if not using Realtime):
```javascript
const checkStatus = async (analysisId) => {
  const res = await fetch(`/cv/status/${analysisId}`);
  const { status } = await res.json();
  if (status === 'completed') {
    // fetch results
  } else {
    // wait and retry
  }
};
```

4. **Handle async jobs**: Show "processing" state while waiting for results.

---

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# With coverage
npm run test:cov
```

---

