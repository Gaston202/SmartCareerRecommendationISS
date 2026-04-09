# Complete Setup Guide for Existing Schema

## 🎯 Quick Start (5 Steps)

### Step 1: Run Database Migrations

Go to **Supabase Dashboard** → **SQL Editor** and run these **in order**:

#### Migration 1: Add Missing Columns (002)
```sql
-- Copy entire contents of: migrations/002_adapt_to_existing_schema.sql
-- This adds: answers, current_question, tags, salary_range_*, etc.
-- And creates: career_roadmaps, user_roadmaps, async_jobs
```

Click "Run". Should see: `Migration completed successfully!`

#### Migration 2: Populate Careers Data (003) - Optional
```sql
-- Copy contents of: migrations/003_data_migration_for_careers.sql
-- This fills new columns from your existing data
```

Click "Run". See: `5 rows affected` or similar.

#### Migration 3: Add Roadmap Templates (004) - Optional
```sql
-- Copy contents of: migrations/004_seed_roadmap_templates.sql
-- This creates roadmap templates for each career
```

Click "Run". Should create templates for all careers.

---

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

This will install NestJS, Supabase client, Redis, BullMQ, etc. Takes 2-3 minutes.

---

### Step 3: Configure Backend .env

Your `.env` file in `backend/` should already have:

```env
SUPABASE_URL=https://tipysihegnyvwxibhbue.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
OPENROUTER_API_KEY=sk-or-v1-...
REDIS_URL=redis://localhost:6379
JWT_SECRET=any-random-secret
CORS_ORIGIN=http://localhost:8081
NODE_ENV=development
PORT=3000
```

✅ All present based on your mobile `.env`.

---

### Step 4: Start Redis (Required for Queues)

```bash
# If you have Docker:
docker-compose up -d redis

# Or if you have Redis installed globally:
redis-server
```

Verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

---

### Step 5: Start Backend Server

```bash
npm run start:dev
```

You should see:
```
[Nest] 12345 - LOG Nest application successfully started
🚀 Backend running on port 3000
📚 API docs: http://localhost:3000/api/docs
```

---

## ✅ Verify Setup

### 1. Check Health Endpoint

```bash
curl http://localhost:3000/api/v1/health
```

Expected:
```json
{"status":"healthy","timestamp":"...","uptime":12}
```

### 2. Test Supabase Connection

Already done! Earlier `test-connection.js` showed ✅.

### 3. Check Which Tables Were Created

```sql
-- In Supabase SQL Editor:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'career_roadmaps', 'user_roadmaps', 'async_jobs'
);
```

Should return 3 rows (if migrations ran successfully).

---

## 🔧 Adapting Services (Important!)

Your existing tables have **different names** than the default backend expects. We created adapted services:

### Files to Replace

1. **Quiz Service:**
   - Rename: `src/modules/quiz/quiz.service.adapted.ts` → `src/modules/quiz/quiz.service.ts`
   - Overwrite the original `quiz.service.ts`

2. **Career Service:**
   - Rename: `src/modules/career/career.service.adapted.ts` → `src/modules/career/career.service.ts`

3. **CV Service:**
   - Rename: `src/modules/cv/cv.service.adapted.ts` → `src/modules/cv/cv.service.ts`

**These adapted services work with your table names:**
- `user_quiz_sessions` (not `quiz_sessions`)
- `user_quiz_responses` (not `quiz_answers`)
- `careers` (with your extra columns: `category`, `average_salary`, `growth_rate`, `demand_level`)
- `cv_analysis` (with `extracted_skills` and `extracted_interests` arrays)

---

## 📱 Update Mobile App

In your mobile app `.env` (not backend), add:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api/v1
```

Then create `src/api/client.ts` with JWT interceptor (see `docs/mobile-migration.md`).

---

## 🧪 Test the Full Flow

### 1. Start a Quiz via API

```bash
# Get a JWT token from your mobile app or:
# In browser: https://tipysihegnyvwxibhbue.supabase.co/auth/v1/authorize?...

curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/v1/quiz/start
```

Should return:
```json
{
  "success": true,
  "data": {
    "session": { "id": "...", "status": "in_progress", ... },
    "question": { "type": "question", "question": "...", "options": [...] }
  }
}
```

### 2. Submit an Answer

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Session-Id: session_id_from_step_1" \
  -H "Content-Type: application/json" \
  -d '{"answer": "I analyze carefully before acting"}' \
  http://localhost:3000/api/v1/quiz/answer
```

Repeat 9 more times to complete quiz.

### 3. Get Career Recommendations

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quiz_session_id": "your_session_id"}' \
  http://localhost:3000/api/v1/career/recommend
```

Should return 5 career matches with AI explanations.

### 4. Upload CV

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/cv.pdf" \
  http://localhost:3000/api/v1/cv/upload
```

Returns `{ analysisId, status: "processing" }`.

Check status:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/v1/cv/status/analysis_id
```

---

## 🐛 Troubleshooting

### "Column does not exist" errors
- Make sure you ran Migration 002 (adds missing columns)
- Check column names match your schema exactly
- Use adapted service files

### "RLS policy violation"
- Backend uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS
- If you're getting RLS errors, verify the service role key is correct in `.env`

### "Redis connection refused"
- Start Redis: `docker-compose up -d redis` or `redis-server`
- Verify: `redis-cli ping` → `PONG`

### "Could not find table 'public.information_schema'"
- This is normal with anon key
- Use Supabase Dashboard to check tables instead

### "OpenRouter API key invalid"
- Verify key in `.env` matches: https://openrouter.ai/keys
- Check you have credits in OpenRouter account

---

## 🚀 Deployment to Production

When ready to deploy:

1. **Push code to GitHub**

2. **Deploy backend** to Vercel/Railway:
   - Set environment variables (use your Supabase keys)
   - Add Redis add-on (Upstash, RedisGreen, or ElastiCache)
   - Build command: `npm run build`
   - Start command: `npm run start:prod`

3. **Update mobile app `.env`:**
   ```env
   EXPO_PUBLIC_BACKEND_URL=https://your-backend.vercel.app/api/v1
   ```

4. **Test production flow**

5. **Monitor logs** for errors

---

## 📊 What's Different from Your Old Setup

| Feature | Old (Direct OpenRouter) | New (Backend) |
|---------|------------------------|---------------|
| Quiz | 5 questions, no state | 10 questions, persistent sessions |
| Careers | AI-only, no caching | Hybrid (deterministic + AI) + Redis cache |
| CV | N/A | Full async pipeline with BullMQ |
| Roadmap | N/A | RAG-based personalization |
| API | Multiple direct calls | Single backend, structured responses |
| Reliability | Single AI model | Multi-model failover + fallbacks |
| Scalability | Limited | Horizontal scaling ready |

---

## 🎉 You're Ready!

1. Run migrations 002, 003, 004
2. Install dependencies: `npm install`
3. Rename `.adapted.ts` service files
4. Start Redis + backend
5. Test with API calls or mobile app
6. Deploy when ready

**Questions?** Check `docs/existing-schema-adaptation.md` for detailed column mappings.
