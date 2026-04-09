# Architecture Decision Records (ADRs)

## ADR-001: Backend Framework - NestJS

**Decision:** Use NestJS for the backend API layer.

**Rationale:**
- **Modular architecture:** Natural separation of concerns (Quiz, Career, CV, Roadmap modules)
- **Built-in DI:** Easy to share services (AI orchestrator, cache, queue)
- **TypeScript-first:** Strong typing aligns with mobile app (TypeScript React Native)
- **Ecosystem:** Mature libraries for guards, interceptors, validation
- **Production-ready:** Battle-tested in large-scale applications
- **WebSockets support:** For future realtime features (optional)

**Alternatives Considered:**
- Express.js: Too low-level, manual wiring needed
- Fastify: Less mature ecosystem than NestJS
- tRPC: Tightly couples backend to frontend (not ideal for separate services)

---

## ADR-002: AI Provider - OpenRouter

**Decision:** Use OpenRouter with multi-model fallback strategy.

**Rationale:**
- **Model flexibility:** Switch between providers/models without code changes
- **Failover:** Redundant models ensure uptime
- **Cost-effective:** Free models available (stepfun, arcee-ai) for startup phase
- **Standard API:** OpenAI-compatible format

**Models:**
- Primary: `arcee-ai/trinity-large-preview:free` (high quality)
- Fallback: `stepfun/step-3.5-flash:free`

**Alternatives Considered:**
- Direct OpenAI: Single vendor lock-in, expensive
- Anthropic via Bedrock: Complex setup, higher cost
- Local LLM (Llama 3.1): Poorer quality, requires GPU infra

**Cost Mitigation:**
- Aggressive caching (24h for most responses)
- Fallback to deterministic logic if all models fail
- Limit calls to AI-only where needed (roadmap personalization, explanations)

---

## ADR-003: Database - Supabase PostgreSQL

**Decision:** Use Supabase Postgres with built-in Auth and Storage.

**Rationale:**
- **Managed service:** No ops overhead (backups, HA, scaling)
- **Auth included:** User management + JWT tokens (integrates with mobile app)
- **Realtime:** Optional for future WebSocket support
- **Storage:** CV PDF storage integrated
- **RLS:** Row-level security for multi-tenancy
- **Edge Functions alternative:** Could replace NestJS backend but less control

**Alternatives Considered:**
- AWS RDS: More expensive, requires manual scaling
- Neon: Good but lacks Auth + Storage integration
- Self-hosted: Too much ops burden for startup

---

## ADR-004: Caching - Redis via Supabase

**Decision:** Use Redis for distributed caching and queue storage.

**Rationale:**
- **In-memory:** Sub-millisecond reads, essential for busy endpoints
- **TTL support:** Automatic expiration
- **Pattern invalidation:** Easy to clear related keys
- **BullMQ requires Redis:** Queue system depends on it

**Alternatives Considered:**
- Supabase CDN: No TTL, only GET/DELETE
- Database cache table: Slower, complex queries
- In-process memory: Won't scale horizontally

---

## ADR-005: Queue System - BullMQ

**Decision:** BullMQ on Redis for async job processing.

**Rationale:**
- **Mature:** battle-tested in production (Bull successor)
- **Feature-rich:** Jobs, priorities, delayed jobs, repeating jobs
- **Redis-backed:** Persistent job storage
- **Node.js native:** Easier to integrate with NestJS

**Use Cases:**
- CV analysis pipeline (PDF extraction → AI → suggestions)
- Bulk roadmap generation (if ever needed)
- Email notifications

**Alternatives Considered:**
- Supabase Edge Functions async: Limited control, no retries
- RabbitMQ: Overkill, more infra to manage
- Celery (Python): Not compatible with Node.js stack
- Custom queue: Reinventing wheel

---

## ADR-006: Hybrid Career Recommendation

**Decision:** Use deterministic scoring engine + AI enhancement (not pure AI).

**Rationale:**
- **Deterministic:** Always produces results, no AI downtime risk
- **Transparent:** Clear logic for why careers match (skills/interests/traits)
- **Auditable:** Can debug scoring, adjust weights
- **Fast:** No AI latency for core matching
- **AI only for explanation:** Cheaper and more reliable

**Algorithm:**
```
Match Score = (Skill Overlap × 0.4) + (Interest Align × 0.3) + (Trait Match × 0.3)
```

**Alternatives Considered:**
- Pure AI (embedding similarity): Expensive, opaque, slow
- Pure rule-based: No personalization, feels robotic
- Collaborative filtering: Not enough user data yet (cold start problem)

---

## ADR-007: Quiz Adaptive Flow - AI-Generated + Fallback

**Decision:** Use AI to generate questions based on previous answers, with static fallback bank.

**Rationale:**
- **Adaptive:** AI tailors questions to user's answers (better UX)
- **Reliability:** Fallback ensures quiz always works even if AI down
- **Variety:** AI can generate infinite questions (no memorization)
- **Quality:** Static backup questions are professionally written

**Flow:**
```
If answers.length < 10:
  if AI_available: generate_question(answers)
  else: return static_questions[answers.length]
If answers.length == 10:
  compute DISC percentages (deterministic)
  call AI for results (with DISC as context)
```

**Alternatives Considered:**
- Fully static bank of 10 questions: No adaptation
- Fully AI-generated: Risky, quality control hard
- Pre-generated path (decision tree): Logic explosion (4^10 paths)

---

## ADR-008: CV Analysis Pipeline - Async Processing

**Decision:** Queue CV analysis for async processing, not sync.

**Rationale:**
- **Long-running:** AI analysis can take 10-30s (too slow for HTTP timeout)
- **User experience:** Upload → instant acknowledgment → polling
- **Resource management:** Queue prevents server overload under burst
- **Retry capability:** BullMQ handles transient failures

**Pipeline:**
```
1. Upload → Store PDF → Create job (status=pending)
2. Worker extracts text (PDF.js)
3. Worker enriches with AI (analysis, suggestions)
4. Store results → Update status=completed
5. Frontend polls or receives WebSocket notification
```

**Alternatives Considered:**
- Synchronous processing: Timeouts, poor UX
- Background job without queue: No retries, no progress tracking
- Separate microservice for PDF processing: Over-architected

---

## ADR-009: Roadmap RAG - Template-Based

**Decision:** Store career roadmap templates, personalize with AI (not fully AI-generated).

**Rationale:**
- **Quality control:** Templates curated by career experts (not AI-generated)
- **Consistency:** All roadmaps have same structure
- **RAG approach:** Retrieval (template) + augmentation (user context) → personalization
- **Caching:** Templates cached, personalized versions cached per user
- **Cost:** Only AI call for personalization, not generation from scratch

**Flow:**
```
Fetch template for career_id
If user profile provided:
  call AI to personalize milestones
Else:
  return base template
Cache personalized per user
```

**Alternatives Considered:**
- AI generates full roadmap each time: Expensive, inconsistent quality
- Static template no personalization: Poor UX
- Vector search on corpus: Requires large roadmap database

---

## ADR-010: Response Validation - Zod

**Decision:** Validate all AI outputs using Zod schemas before using them.

**Rationale:**
- **Type safety:** Runtime validation beyond TypeScript interfaces
- **Schema evolution:** Zod schemas can be versioned
- **Error recovery:** Catch malformed AI responses, trigger fallbacks
- **Documentation:** Schemas serve as API contracts

**Schemas defined in:** `src/core/ai-orchestrator/ai-orchestrator.service.ts`

**Validation points:**
- After extracting JSON from AI response
- Before returning to controller
- Before caching

**Alternatives Considered:**
- TypeScript interfaces only: No runtime checks
- Yup: Less TypeScript-native than Zod
- Joi: Not TypeScript-first

---

## ADR-011: Session State - Database + Redis

**Decision:** Store quiz sessions in both DB (persistence) and Redis (performance).

**Rationale:**
- **Persistence:** DB ensures no data loss even if Redis restarts
- **Performance:** Redis for fast reads/writes during quiz flow
- **Sync strategy:** Write-through to DB on each answer, cache updates
- **Recovery:** On cache miss, hydrate from DB

**Key pattern:**
```
POST /answer:
  1. Redis GET session (fast)
  2. Validate state
  3. Append answer
  4. UPDATE quiz_sessions in DB (new answers, new question)
  5. Redis SET session (new state)
```

**Alternatives Considered:**
- DB only: Read/write latency, no caching
- Redis only: Data loss risk if cache cleared
- Event sourcing: Overkill for 10-question flow

---

## ADR-012: API Versioning - URL Path

**Decision:** Version via URL path (`/api/v1/`) instead of headers.

**Rationale:**
- **Cache friendliness:** URL path versions cache separately
- **Visibility:** Clear to developers and monitoring tools
- **Simple:** No header parsing needed
- **Standard:** REST convention

**Alternatives Considered:**
- Header-based: More complex, less visible
- Query param: Not recommended for versioning
- No versioning: Breaking changes would break clients

---

## ADR-013: Error Handling - Structured + Centralized

**Decision:** Use centralized `ValidationExceptionFilter` with consistent format.

**Rationale:**
- **Consistency:** All errors return `{statusCode, timestamp, path, error}`
- **Logging:** Standardized error logging for monitoring
- **Client-friendly:** Clear error messages, timestamps for debugging
- **Type safety:** `HttpException` with status code prop

**Error categories:**
- `400` Bad Request (validation errors)
- `401` Unauthorized (invalid/missing JWT)
- `403` Forbidden (RLS violation)
- `404` Not Found (resource doesn't exist)
- `409` Conflict (duplicate session)
- `422` Unprocessable Entity (AI service issue)
- `429` Too Many Requests (rate limit)
- `500` Internal Server Error
- `503` Service Unavailable (AI/Redis down)

**Alternatives Considered:**
- Custom error classes per domain: Documentation overhead
- Throw strings only: No status codes
- No centralized filter: Duplicate error formatting everywhere

---

## ADR-014: Async Status Polling - Dedicated Table

**Decision:** Store async job status in `async_jobs` table for frontend polling.

**Rationale:**
- **Visibility:** Users can check status from any device
- **Persistence:** Job status survives server restarts
- **Admin visibility:** DB query shows all jobs (not just Redis)
- **TTL:** Auto-cleanup old jobs

**Alternative to realtime:** Easier to implement than WebSocket for mobile apps (no persistent connections).

**Polling pattern:**
```javascript
const poll = async (jobId) => {
  const res = await fetch(`/jobs/status/${jobId}`);
  const { status, progress } = await res.json();
  if (status === 'completed') return result;
  if (status === 'failed') throw error;
  setTimeout(() => poll(jobId), 2000); // 2s interval
};
```

**Alternatives Considered:**
- WebSocket only: Complex on mobile (background/suspend handling)
- Redis job lookup: No persistence, no cross-instance visibility
- Callback URL: Hard with mobile apps (no public endpoint)

---

## ADR-015: Configuration - Environment Variables

**Decision:** Use dotenv (ConfigModule) with required environment variables.

**Rationale:**
- **12-factor app compliance:** Config external to code
- **Type safety:** ConfigService provides typed getters
- **Validation:** Fail fast on missing required vars
- **Documentation:** `.env.example` lists all options

**Required vars:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `REDIS_URL`

**Alternatives Considered:**
- Config files (yaml/json): Not environment-specific
- Hardcoded defaults: Danger of secrets in code
- Custom validation library: Nest Config is sufficient

---

## Monitoring & Observability

### Logging
- **Pino** JSON logger (structured)
- **Log levels:** `NODE_ENV=production` → `info`, `development` → `verbose`
- **Request logging:** Pino HTTP middleware (adds duration, status)
- **Stack traces:** For `error` level logs

### Metrics (Future)
- AI token usage per endpoint
- Queue depth (pending vs active jobs)
- Cache hit rate
- Request latency (p50, p95, p99)
- Error rate by endpoint

### Alerting (Future)
- AI service failures > 10% in 5m
- Queue length > 100
- Error rate > 5%

---

## Security Considerations

1. **JWT Validation:** All endpoints validate Supabase JWT (never trust client-side checks)
2. **RLS:** All queries use `user_id` filter from JWT, never trust passed user_id
3. **Input Validation:** `class-validator` on DTOs
4. **Rate Limiting:** Planned: `express-rate-limit` per IP/user
5. **Helmet:** Security headers
6. **PII Sanitization:** Before logging `request_body`, strip sensitive fields
7. **Secrets:** Never commit `.env`, use server-side provisioning
8. **Storage:** CV PDFs in private bucket, signed URLs only

---

## Scalability Path

**Phase 1 (Current):** Single instance NestJS + Supabase + Redis
**Phase 2 (10k users):** Add multiple API instances behind load balancer
**Phase 3 (100k users):**
- Separate AI workers (horizontal scaling)
- Read DB replicas
- Redis Cluster for cache sharding
- Queue sharding (multiple queues per type)

**Vertical scaling limits:**
- NestJS instance: ~2kHz (burst), then queue/persist
- DB connection pool: 100 connections max per instance

---

## Open Questions

1. **Real-time notifications:** Use Supabase Realtime for CV completion? (Note: Would require WebSocket on mobile)
2. **Progressive Web App:** Should backend return Web App Manifest? (Later)
3. **SSO:** Support Google/Apple via Supabase Auth (just enable in Supabase)
4. **Internationalization:** Multi-language prompts? (Not MVP)
5. **Bulk operations:** Admin export user data? (GDPR) - planned
6. **Admin dashboard:** For support staff? - separate admin domain

---

## References

- **Supabase Docs:** https://supabase.com/docs
- **NestJS Docs:** https://docs.nestjs.com/
- **BullMQ Docs:** https://docs.bullmq.io/
- **OpenRouter:** https://openrouter.ai/docs
