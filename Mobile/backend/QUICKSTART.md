# Backend Quick Start Guide

## Prerequisites
- Node.js 18+
- Docker + Docker Compose
- Supabase account (free tier works)
- OpenRouter API key (free tier)

## 1. Setup Supabase Project

1. Go to [supabase.com](https://supabase.com) and create new project
2. Wait for provisioning (~2 minutes)
3. Go to Project Settings → Database → Connection string → **Copy** `Supabase <-> Postgres` connection string
4. Go to Project Settings → API → **Copy** `anon` public key and `service_role` key
5. Go to Storage → Create bucket: `cv-uploads` (set to private)

## 2. Clone & Configure

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
OPENROUTER_API_KEY=your_openrouter_key
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:8081
```

## 3. Start Local Services

```bash
docker-compose up -d
```

Check they're running:
```bash
docker-compose ps
# Should show postgres and redis healthy
```

## 4. Run Database Migration

1. Open Supabase Dashboard → Your Project → SQL Editor
2. Open file: `migrations/001_initial_schema.sql`
3. Copy entire contents and paste into SQL editor
4. Click "Run" (takes ~10 seconds)

Verify:
```sql
-- Run in SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Should see: api_audit_logs, async_jobs, careers, career_match_results, career_roadmaps, cv_analyses, quiz_answers, quiz_sessions, user_profiles, user_roadmaps
```

## 5. Install Dependencies & Start Server

```bash
npm install
npm run start:dev
```

You should see:
```
[Nest] 12345  - 2025-04-07 12:00:00   LOG  Nest application successfully started
🚀 Backend running on port 3000
📚 API docs: http://localhost:3000/api/docs
```

## 6. Test API

Open in browser: **http://localhost:3000/api/docs**

You'll see Swagger UI. Try:

### Health Check (no auth):
```bash
curl http://localhost:3000/api/v1/health
```

### Quiz (requires auth):

1. Get a valid JWT from your mobile app (Supabase Auth login)
   - Or test with: `npx expo start` → app login → inspect token in console

2. Start quiz:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "X-Session-Id: 123" \
     http://localhost:3000/api/v1/quiz/start
```

Response:
```json
{
  "success": true,
  "data": {
    "session": { "id": "...", "status": "in_progress", ... },
    "question": { "type": "question", "question": "...", "options": [...] }
  }
}
```

3. Submit answer:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Session-Id: session_id_from_step_2" \
  -H "Content-Type: application/json" \
  -d '{"answer": "I analyze carefully before acting"}' \
  http://localhost:3000/api/v1/quiz/answer
```

Repeat for 10 questions, then you'll get results.

---

## 7. Update Mobile App

In your mobile app `.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 8. Run Workers (Optional, for CV async)

In separate terminal:

```bash
# CV analysis worker
npm run worker:cv

# AI processing worker
npm run worker:ai
```

For production, these run as separate processes/services.

---

## Common Issues

### "Redis connection refused"
- Check: `docker-compose ps` → is redis running?
- Fix: `docker-compose logs redis` (if error, restart: `docker-compose restart redis`)

### "Supabase URL missing"
- Double-check `.env` file in `backend/` (not root)
- Backend must read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### "JWT token invalid"
- Ensure you're using **access token** from Supabase Auth session (starts with `eyJ...`)
- Don't use refresh token
- Token must be from same Supabase project

### "(row policy for update)"
- The service role key bypasses RLS. If you're getting RLS errors in backend:
  - Verify `SUPABASE_SERVICE_ROLE_KEY` is correct (not anon key)
  - Service role should NOT be used in mobile app (keep anon there)

### "OpenRouter API key invalid"
- Get key from https://openrouter.ai/keys
- Add `sk-` prefix if not present (OpenRouter keys start with `sk-`)

### "Port already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or change PORT in .env
```

---

## Project Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/          - JWT validation, Supabase user lookup
│   │   ├── quiz/          - Quiz endpoints, session management
│   │   ├── career/        - Hybrid recommendations
│   │   ├── cv/            - CV upload & async processing
│   │   ├── roadmap/       - RAG-based roadmap generation
│   │   └── shared/        - Common decorators, filters
│   ├── core/
│   │   ├── ai-orchestrator/ - Central AI management (prompts, validation, caching)
│   │   ├── cache/         - Redis wrapper
│   │   ├── queue/         - BullMQ setup
│   │   ├── database/      - Supabase client
│   │   └── logger/        - Pino logger
│   ├── workers/           - Background job processors
│   ├── app.module.ts
│   └── main.ts
├── docs/                  - Full documentation
├── migrations/            - Supabase SQL schema
├── tests/                 - Test suites (future)
├── package.json
├── Dockerfile
└── docker-compose.yml
```

---

## Production Deployment

1. **Build:**
```bash
npm run build
```

2. **Push to Vercel / Railway / ECS:**
   - Set all env vars
   - Connect Supabase (already exists)
   - Deploy!

3. **Set up Redis:** Use RedisGreen add-on or ElastiCache

4. **Run workers:** Deploy as separate services
```bash
npm run worker:cv
npm run worker:ai
```

5. **Set up domain:** Point to your backend URL

6. **Update mobile app:** Change `EXPO_PUBLIC_BACKEND_URL` to production domain

---

## Monitoring

Check logs:
```bash
# Local (development)
# Console output shows all requests

# Production (Vercel)
vercel logs your-app.vercel.app --since 1h

# Database slow queries
-- In Supabase SQL:
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Development Workflow

1. **Make changes** to code
2. **Hot reload:** `npm run start:dev` auto-restarts on changes
3. **Test API** with Swagger UI or curl
4. **Check database:** Supabase Dashboard → Table Editor
5. **Check Redis:** `redis-cli ping` (if installed locally)

---

## Next Steps After Setup

- [ ] Run full quiz flow start→finish
- [ ] Upload test CV (create simple PDF with your skills)
- [ ] Generate roadmap for a career
- [ ] Check Supabase tables populated with data
- [ ] Inspect Redis keys: `redis-cli keys '*'` (optional)
- [ ] Review API logs in console
- [ ] Deploy to staging (Vercel preview URL)
- [ ] Connect mobile app to staging backend
- [ ] Run E2E tests

---

## Need Help?

- Backend issues → Check `docs/api.md`, `docs/database.md`
- Architecture → `docs/architecture-decisions.md`
- Mobile migration → `docs/mobile-migration.md`
- Supabase: https://supabase.com/docs
- NestJS: https://docs.nestjs.com

---

**You're ready to build!** 🚀
