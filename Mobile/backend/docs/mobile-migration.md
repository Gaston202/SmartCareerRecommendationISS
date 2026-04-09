# Mobile App Migration Guide

## Overview

This guide explains how to update your React Native/Expo mobile app to use the new production backend instead of calling OpenRouter directly.

---

## Migration Steps

### 1. Update Environment Variables

In your mobile app `.env` file:

```env
# Remove: EXPO_PUBLIC_OPENROUTER_API_KEY

# Add:
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api/v1  # or your deployed backend URL
```

**Note:** The mobile app continues to use Supabase Auth (client). The backend uses the service role key for server-side operations.

---

### 2. Update API Client (`src/api/`)

Create a new generic API client that includes auth headers.

**File:** `src/api/client.ts`

```typescript
import axios from 'axios';
import { supabase } from './supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

export const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add JWT auth header
apiClient.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired, redirect to login
      supabase.auth.signOut();
      // Navigate to login screen
    }
    return Promise.reject(error);
  }
);
```

---

### 3. Replace Quiz API Calls

**Old:** `src/features/quiz/api.ts` → calls OpenRouter directly

**New:** Call backend endpoints with JWT header.

Create new API functions:

**File:** `src/features/quiz/backend-api.ts`

```typescript
import { apiClient } from '../../api/client';
import type { QuizNextResponse } from './types';

export async function startQuizBackend(): Promise<{ sessionId: string; question: QuizNextResponse }> {
  const response = await apiClient.post('/quiz/start', {});
  const { data } = response;

  if (!data.success) {
    throw new Error(data.error || 'Failed to start quiz');
  }

  return {
    sessionId: data.data.session.id,
    question: data.data.question,
  };
}

export async function submitAnswerBackend(
  sessionId: string,
  answer: string
): Promise<{ question?: QuizNextResponse; results?: any }> {
  const response = await apiClient.post('/quiz/answer', { answer }, {
    headers: {
      'X-Session-Id': sessionId,
    },
  });

  const { data } = response;
  if (!data.success) {
    throw new Error(data.error || 'Failed to submit answer');
  }

  return data.data;
}

export async function getQuizResultBackend(sessionId: string): Promise<any> {
  const response = await apiClient.get(`/quiz/result/${sessionId}`);
  const { data } = response;

  if (!data.success) {
    throw new Error(data.error || 'Failed to get quiz results');
  }

  return data.data;
}
```

---

### 4. Update Quiz Screen

**File:** `src/screens/QuizScreen.tsx`

Changes:

1. **Remove imports:**
```typescript
// Remove:
import { fetchQuizNext } from '../features/quiz/api';
import { clearQuizSession, getQuizSession, saveQuizSession } from '../features/quiz/storage';
```

2. **Replace `fetchQuizNext` calls with `startQuizBackend` / `submitAnswerBackend`:**

```typescript
const loadNext = async (nextAnswers: string[]) => {
  setLoading(true);
  setError(null);

  if (nextAnswers.length > 0) {
    setMessages((prev) => [
      ...prev,
      { id: `thinking-${Date.now()}`, role: "ai", content: "__THINKING__" },
    ]);
  }

  try {
    let response;
    if (nextAnswers.length === 0) {
      // First question: start quiz
      const result = await startQuizBackend();
      response = result.question;
      // Save session ID for subsequent calls
      await AsyncStorage.setItem('quiz_session_id', result.sessionId);
    } else {
      // Submit answer and get next question or results
      const sessionId = await AsyncStorage.getItem('quiz_session_id');
      if (!sessionId) throw new Error('No quiz session found');

      response = await submitAnswerBackend(sessionId, nextAnswers[nextAnswers.length - 1]);
    }

    setMessages((prev) => prev.filter((m) => m.content !== "__THINKING__"));

    if (response.type === "question") {
      // Handle question (same as before)
      setCurrentQuestion(response);
      setQuestionsAsked((prev) => [...]);
      setMessages((prev) => [...]);
    } else {
      // Quiz complete - results returned directly
      setCurrentQuestion(null);
      setResults(response);
      await saveQuizSession({
        questionsWithAnswers: questionsAsked,
        results: response,
        completedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    // Error handling (same pattern)
  } finally {
    setLoading(false);
  }
};
```

3. **Remove local storage for sessions:** The backend now persists everything. You can keep `AsyncStorage` caching for offline UX, but source of truth is backend.

---

### 5. Update Career Recommendations

**Old:** Career cards already generated from quiz results (frontend-hoc).

**New:** After quiz completes, call `/career/recommend` with quiz session ID + CV analysis ID (if available).

**File:** `src/features/career/api.ts` (new)

```typescript
import { apiClient } from '../../api/client';

export async function getCareerRecommendations(
  quizSessionId: string,
  cvAnalysisId?: string
): Promise<any[]> {
  const response = await apiClient.post('/career/recommend', {
    quiz_session_id: quizSessionId,
    cv_analysis_id: cvAnalysisId,
  });

  const { data } = response;
  if (!data.success) {
    throw new Error(data.error || 'Failed to get recommendations');
  }

  return data.data;
}
```

**Usage in QuizScreen:**
After quiz completes, call `getCareerRecommendations(sessionId, cvAnalysisId)` and pass results to `CareerCard`.

---

### 6. Update CV Analysis

**File:** `src/features/cv/CVAnalysisScreen.tsx`

1. **Replace `useCvAnalysis` hook:** It currently calls some API. Replace with:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

const fetchCvAnalysis = async (): Promise<any> => {
  const response = await apiClient.get('/cv/result/latest');
  const { data } = response;
  if (!data.success) throw new Error(data.error || 'Failed to fetch CV analysis');
  return data.data;
};

export const useCvAnalysis = () => {
  return useQuery({
    queryKey: ['cv-analysis'],
    queryFn: fetchCvAnalysis,
    staleTime: 30000,
  });
};
```

2. **CV Upload (in `CVAnalysisScreen` or separate upload screen):**

```typescript
import { apiClient } from '../../api/client';

const uploadCv = async (file: File | Uri): Promise<{ analysisId: string; status: string }> => {
  const formData = new FormData();
  // Convert Expo File to blob
  formData.append('file', {
    uri: file.uri,
    type: 'application/pdf',
    name: file.name || 'cv.pdf',
  } as any);

  const response = await apiClient.post('/cv/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const { data } = response;
  if (!data.success) {
    throw new Error(data.error || 'Upload failed');
  }

  return data.data;
};
```

3. **Polling for completion** (if not using Realtime):

```typescript
const pollCvStatus = async (analysisId: string, onComplete: (result: any) => void) => {
  const maxAttempts = 30; // 1 minute max
  let attempts = 0;

  const interval = setInterval(async () => {
    try {
      const response = await apiClient.get(`/cv/status/${analysisId}`);
      const { data } = response;
      const { status } = data.data;

      if (status === 'completed') {
        clearInterval(interval);
        onComplete(data.data); // Full analysis data
      } else if (status === 'failed') {
        clearInterval(interval);
        // Show error
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        // Show timeout error
      }
    } catch (error) {
      clearInterval(interval);
    }

    attempts++;
  }, 2000); // Poll every 2s
};
```

---

### 7. Update Roadmap Generation

**File:** `src/screens/CareerRoadmapScreen.tsx`

Replace any OpenRouter calls with backend API:

```typescript
import { apiClient } from '../../api/client';

const generateRoadmap = async (careerId: string): Promise<any> => {
  const response = await apiClient.post('/roadmap/generate', {
    career_id: careerId,
    use_async: false, // or true for async
    user_profile: {
      skills: userSkills,
      novaProfile: novaProfile,
      // ...
    },
  });

  const { data } = response;
  if (!data.success) {
    throw new Error(data.error || 'Failed to generate roadmap');
  }

  return data.data;
};
```

---

### 8. Remove OpenRouter Dependencies

From mobile app:
- Delete `src/api/openrouter.ts`
- Delete related types if no longer used
- Remove `EXPO_PUBLIC_OPENROUTER_API_KEY` from `.env`

**Keep Supabase** for auth + realtime (if used).

---

### 9. Testing End-to-End

1. **Start backend locally:** `cd backend && npm run start:dev`
2. **Start mobile app:** `npx expo start`
3. **Test quiz flow:**
   - Start quiz → first question appears
   - Answer all 10 questions → results show (Nova profile + careers)
   - Backend logs show request/response
4. **Test CV upload:**
   - Upload PDF → `status: "processing"`
   - Wait for completion → check analysis screen
5. **Test roadmap:**
   - Tap "Generate roadmap" for a career
   - Roadmap screen shows milestones

---

### 10. Error Handling

Backend returns consistent error format:

```json
{
  "statusCode": 500,
  "timestamp": "2025-04-07T...",
  "path": "/api/v1/quiz/answer",
  "error": "Something went wrong"
}
```

Update error handling in mobile app to expect this shape:

```typescript
try {
  const response = await apiClient.post('/quiz/answer', ...);
  const { data, status } = response;
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.error || 'Request failed');
  }
} catch (error: any) {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    Alert.alert('Error', data.error || 'Network error');
  } else {
    Alert.alert('Error', error.message);
  }
}
```

---

## Checklist

- [ ] Add `EXPO_PUBLIC_BACKEND_URL` to `.env`
- [ ] Create `src/api/client.ts` with JWT interceptor
- [ ] Remove OpenRouter imports and functions
- [ ] Replace quiz API calls with `startQuizBackend`, `submitAnswerBackend`, `getQuizResultBackend`
- [ ] Update `QuizScreen.tsx` to use backend endpoints and session ID header
- [ ] Replace career recommendations call with `/career/recommend`
- [ ] Update CV analysis (`useCvAnalysis`) to call `/cv/result/latest`
- [ ] Implement CV upload with multipart/form-data
- [ ] Add CV status polling (if not using Supabase Realtime)
- [ ] Update roadmap generation to call `/roadmap/generate`
- [ ] Test all flows end-to-end with backend running
- [ ] Remove `EXPO_PUBLIC_OPENROUTER_API_KEY` from `.env` and `babel.config.js` (if present)

---

## Performance Considerations

### Caching
The mobile app already uses React Query. Ensure:
- Query keys align with backend resources
- Stale time configured (e.g., quiz results cached indefinitely, CV analysis 5min)
- Enabled background refetch on reconnect

### Offline Support
Quiz is not offline-friendly (requires AI). Consider:
- Cache quiz questions locally as fallback
- Show "offline" message if network unavailable

---

## Debugging Tips

1. **Enable backend logging:** `NODE_ENV=development` for verbose logs
2. **Check JWT:** In mobile app, log `supabase.auth.getSession()` to verify token
3. **API inspector:** Use React Native Debugger or Flipper to inspect outgoing requests
4. **Backend logs:** Console output from NestJS shows all requests
5. **Database queries:** Supabase Dashboard → Database → Query editor

---

## Deployment

### Backend Deployment Options:

**Option A: Vercel** (easiest, serverless)
- Push to GitHub
- Import in Vercel
- Set env vars
- Auto-deploys on merge to `main`

**Option B: Railway**
- Connect repo
- Build command: `npm run build`
- Start command: `npm run start:prod`
- Attach Postgres (or use Supabase)
- Add Redis instance

**Option C: AWS ECS / DigitalOcean App Platform**
- Container-based
- More control, slightly more ops work

### Mobile App Updates:
Once backend deployed:
1. Change `EXPO_PUBLIC_BACKEND_URL` to production URL
2. Rebuild app: `npx expo prebuild` (if native modules changed)
3. Submit to stores (TestFlight / Google Play Beta)

---

## Support

If you encounter issues:
1. Check backend logs (NestJS console output)
2. Verify Supabase RLS policies allow access
3. Test API endpoints with Postman/curl with JWT token
4. Check Redis connection (queue async tasks won't work without it)
5. Ensure OpenRouter API key has credits available

---

## Next Steps After Migration

- [ ] Implement Supabase Realtime for CV completion notifications
- [ ] Add rate limiting middleware
- [ ] Add request logging to `api_audit_logs`
- [ ] Set up monitoring (error tracking like Sentry)
- [ ] Add admin dashboard (separate module)
- [ ] Implement user preferences storage (`user_profiles`)
- [ ] Add fingerprinting/device ID for fraud prevention

---

## Summary of Changes

| Feature | Old (Mobile → OpenRouter) | New (Mobile → Backend → Supabase) |
|---------|---------------------------|-----------------------------------|
| Quiz | Direct OpenRouter calls | Persistent sessions, stateful flow |
| Careers | Computed purely in memory | Hybrid + persistent + cached |
| CV | N/A | Async pipeline with queuing |
| Roadmap | N/A | RAG-based personalization |
| Auth | None | Supabase Auth + JWT validation |
| Storage | None | Supabase Storage (CV PDFs) |
| Caching | None | Redis (24h+ TTL) |
| Reliability | Single point of failure | Multi-model failover, fallbacks |

**Total new backend files created: ~40 files** (see `backend/` directory)
