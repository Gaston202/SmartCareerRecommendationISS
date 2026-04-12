# Smart Career Recommendation - Backend API

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
All endpoints except `/health` require a **Bearer token** from Supabase Auth.

```
Authorization: Bearer <JWT_TOKEN>
```

---

## Quiz Endpoints

### `POST /quiz/start`
Start a new quiz session.

**Headers:**
- `X-Session-Id` (optional for resume)

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "user_id": "uuid",
      "status": "in_progress",
      "current_question": 1,
      "answers": []
    },
    "question": {
      "type": "question",
      "question": "When facing a professional challenge...",
      "question_number": 1,
      "total_questions": 10,
      "options": [
        { "id": "red", "label": "I move straight to action...", "icon": "flash" },
        { "id": "blue", "label": "I analyze carefully...", "icon": "analytics" },
        { "id": "green", "label": "I consult others...", "icon": "people" },
        { "id": "yellow", "label": "I generate fresh ideas...", "icon": "brush" }
      ]
    }
  }
}
```

---

### `POST /quiz/answer`
Submit an answer and receive next question or final results.

**Headers:**
- `X-Session-Id`: `quiz_session_uuid`

**Body:**
```json
{
  "answer": "I move straight to action and decide quickly"
}
```

**Response (next question):**
```json
{
  "success": true,
  "data": {
    "question": { ... } // Next question object
  }
}
```

**Response (quiz complete):**
```json
{
  "success": true,
  "data": {
    "type": "results",
    "careers": [
      {
        "title": "Software Engineer",
        "description": "Design, build, and maintain robust technical solutions.",
        "matchPercent": 82,
        "tags": ["Technology", "Problem Solving", "Continuous Learning"]
      },
      ...
    ],
    "novaProfile": {
      "headline": "...",
      "professionalIdentity": "...",
      "behavior": {
        "primaryStyle": "Conscientiousness (Blue)",
        "discPercentages": { "red": 25, "yellow": 25, "green": 25, "blue": 25 }
      },
      ...
    }
  }
}
```

---

### `GET /quiz/result/:sessionId`
Retrieve completed quiz results.

**Response:** Same as above `results` object.

---

### `GET /quiz/history`
Get user's past quiz sessions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "completed",
      "completed_at": "2025-04-07T...",
      "current_question": 10
    }
  ]
}
```

---

## Career Endpoints

### `POST /career/recommend`
Get career recommendations based on quiz and optionally CV.

**Body:**
```json
{
  "quiz_session_id": "uuid",
  "cv_analysis_id": "uuid"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "career": {
        "id": "uuid",
        "title": "Software Engineer",
        "description": "...",
        "required_skills": ["JavaScript", "React"],
        "tags": ["Technology"]
      },
      "match_score": 87,
      "match_reasons": ["Skills matched: JavaScript, React", "Interests aligned: Technology"],
      "ai_explanation": "Your technical skills and analytical approach align strongly with software engineering.",
      "ranking": 1
    },
    ...
  ]
}
```

---

### `GET /career/all`
Fetch all careers (reference data).

---

## CV Analysis Endpoints

### `POST /cv/upload`
Upload a CV PDF for analysis.

**Content-Type:** `multipart/form-data`

**Body:**
```
file: <PDF_BINARY>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysisId": "uuid",
    "status": "pending"
  }
}
```

---

### `GET /cv/result/:analysisId`
Get CV analysis result by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "pdf_url": "https://...",
    "status": "completed",  // pending | processing | completed | failed
    "extracted_data": {
      "skills": ["JavaScript", "React", "Node.js"],
      "experience": [
        {
          "title": "Senior Developer",
          "company": "Tech Co",
          "duration": "3 years"
        }
      ],
      "education": [
        { "degree": "BSc Computer Science", "institution": "University" }
      ],
      "summary": "..."
    },
    "ats_score": 78,
    "ats_issues": [
      { "type": "formatting", "severity": "medium", "description": "...", "fix": "..." }
    ],
    "suggested_improvements": [
      { "section": "Experience", "suggestion": "...", "example": "..." }
    ],
    "completed_at": "2025-04-07T..."
  }
}
```

---

### `GET /cv/result/latest`
Get the latest CV analysis for the authenticated user.

---

### `GET /cv/status/:analysisId`
Check processing status (for polling).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "processing",
    "progress": 50,
    "updated_at": "2025-04-07T..."
  }
}
```

---

## Roadmap Endpoints

### `POST /roadmap/generate`
Generate a personalized career roadmap.

**Body:**
```json
{
  "career_id": "uuid",
  "use_async": false,  // optional, defaults to false
  "user_profile": {
    "skills": ["JavaScript", "React"],
    "novaProfile": { ... },  // from quiz
    "cvSummary": "..."
  }
}
```

**Response (synchronous):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "career_id": "uuid",
    "title": "Roadmap to Software Engineer",
    "description": "A 6-month plan...",
    "milestones": [
      {
        "id": "1",
        "title": "Month 1-2: Core Skills",
        "duration_weeks": 8,
        "tasks": [
          { "id": "t1", "title": "Master React hooks", "estimated_hours": 20 }
        ],
        "resources": [
          { "type": "course", "title": "React Course", "url": "..." }
        ]
      }
    ],
    "total_duration_weeks": 24,
    "created_at": "2025-04-07T..."
  }
}
```

**Response (async queued):**
```json
{
  "success": true,
  "data": {
    "jobId": "bullmq-job-id",
    "message": "Roadmap generation queued"
  }
}
```

---

### `GET /roadmap/career/:careerId`
Fetch roadmap for a specific career (cached).

---

### `GET /roadmap/status/:jobId`
Check async roadmap generation job status.

---

## Health Check

### `GET /health`
Service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-04-07T...",
  "uptime": 3600
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "statusCode": 401,
  "timestamp": "2025-04-07T...",
  "path": "/api/v1/quiz/start",
  "error": "Invalid or expired token"
}
```

**Status Codes:**
- `200` - Success
- `201` - Created (CV upload)
- `202` - Accepted (async job queued)
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate session)
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - AI Service Unavailable

---

## Rate Limiting

Production deployment will have rate limiting:
- 60 requests/minute per user on AI endpoints
- 100 requests/minute on read-only endpoints
- Burst capacity: 2x sustained rate

---

## API Versioning

Current version: `v1`

API is versioned via URL path: `/api/v1/resource`

Future versions will co-exist: `/api/v2/resource`

---

## Production Deployment Notes

### Environment Variables
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENROUTER_API_KEY=your_openrouter_key
REDIS_URL=redis://...
JWT_SECRET=...
CORS_ORIGIN=http://localhost:8081
```

### CORS
Mobile app origin: `http://localhost:8081` (Expo dev) or your production URL.

### Timeouts
- AI calls: 30s
- Database queries: 10s
- Redis operations: 5s
- Request processing: 60s

---

## Mobile App Integration Checklist

- [ ] Replace OpenRouter API calls with backend endpoints
- [ ] Add `Authorization: Bearer <supabase_jwt>` to all requests
- [ ] Add `X-Session-Id` header to quiz answer submissions
- [ ] Implement polling for CV async status (or use Supabase Realtime)
- [ ] Handle `status: "processing"` for CV analysis
- [ ] Cache responses with React Query (already in place)
- [ ] Update error handling to match backend error format
- [ ] Test quiz flow end-to-end (10 questions → results → career matches)
- [ ] Test CV upload and polling
- [ ] Test roadmap generation (sync and async)

---

## Monitoring & Observability

- Structured JSON logs (Pino)
- API request/response logging
- AI token usage tracking
- Queue depth & job failure metrics
- Database slow query monitoring

---

## Schema Reference

See `migrations/001_initial_schema.sql` for complete database schema.

Key tables:
- `quiz_sessions` - Quiz session state
- `quiz_answers` - Individual answers
- `career_match_results` - Computed career matches
- `cv_analyses` - CV analysis results (async)
- `career_roadmaps` - Roadmap templates
- `user_roadmaps` - Personalized roadmaps
- `async_jobs` - Job tracking for frontend polling
