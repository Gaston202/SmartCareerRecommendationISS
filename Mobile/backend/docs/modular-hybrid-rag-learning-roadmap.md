# Modular Hybrid RAG for Learning Roadmap (V1)

## 0. Repository Audit (Current State)

### Existing integration points already in repo
- Career backbone logic: `src/modules/career/career.service.ts`
  - Uses `careers.required_skills`, `preferred_interests`, `typical_traits`
- Existing roadmap APIs: `src/modules/roadmap/roadmap.controller.ts`
- Existing learning roadmap module: `src/modules/learning-roadmap/*`
  - `learning_skills`, `learning_courses`, `skill_dependencies`, `user_learning_roadmaps`
- Supabase integration pattern: `src/core/database/database.service.ts`
- Caching pattern: `src/core/cache/cache.service.ts`
- Existing Python service area: `Mobile/server/*` and `Mobile/server/scrapers/*`

### Architectural decision for this implementation
- Extend **existing `RoadmapModule`** (do not create parallel backend architecture)
- Keep V1 as **stored knowledge only** (no broad live web search)
- Add modular RAG data model + retrieval + planner services

---

## A) Module Boundaries and End-to-End Flow

### Backend modules (NestJS)
- `RoadmapRetrievalService`
  - Structured filtering
  - Keyword/FTS retrieval
  - Semantic retrieval (if embeddings available)
  - Score fusion + reranking
  - Retrieval confidence and weak-evidence decision
- `RoadmapPlannerService`
  - Builds ordered roadmap from role backbone + user gap analysis
  - Attaches best resource per step
  - Produces per-step confidence and weak-evidence handling
- `RoadmapRefreshService`
  - Creates refresh jobs in `ingestion_jobs`

### Python worker modules
- Provider crawling/fetching (Scrapling)
- Normalization and dedup
- Chunking and embedding generation
- Supabase upsert for resources + chunks + skill maps
- Monthly and on-demand refresh orchestration

### Supabase responsibilities
- Structured records (`resources`, maps)
- Chunk records (`resource_chunks` + pgvector)
- Search functions (`roadmap_keyword_search`, `roadmap_semantic_search`)
- Ingestion job tracking (`ingestion_jobs`)

### End-to-end flow
1. User calls `POST /roadmap/plan`
2. Planner resolves target career/role
3. Planner derives required skills from career backbone
4. Planner computes user skill gaps (CV + profile + quiz signals)
5. For each missing skill, Retrieval service runs hybrid search
6. Retrieval returns best evidence + confidence
7. Planner builds ordered roadmap steps and confidence
8. If weak evidence: response includes `message = "insufficient reliable sources"`

---

## B) Database Design (Implemented in migration 007)

Migration file:
- `migrations/007_modular_rag_schema.sql`

### Tables added
- `resources`
  - Structured metadata for filtering/ranking
  - Dedup fields (`source_url_normalized`, `normalized_content_sha256`)
  - Re-embed support (`embedding_status`, `embedding_updated_at`)
  - FTS column `search_tsv`
- `resource_chunks`
  - Chunked text + `embedding vector(1536)`
  - Dedup (`chunk_sha256`)
  - FTS + vector index
- `role_skill_map`
  - Role/career to skills with priority and prerequisites
- `skill_resource_map`
  - Skill-to-resource relevance and primary mapping
- `ingestion_jobs`
  - Monthly/on-demand refresh tracking

### Indexes and search
- Filter indexes on language/level/provider/free_or_paid/duration
- GIN indexes on `skill_tags`, `target_roles`, `search_tsv`
- HNSW vector index on `resource_chunks.embedding`

### RPC functions added
- `roadmap_keyword_search(query_text, limit_count, filters)`
- `roadmap_semantic_search(query_embedding, limit_count, filters)`

### Dedup and changed-content strategy
- Dedup at URL and normalized content hash level
- Chunk-level dedup via `(resource_id, chunk_sha256)`
- Re-embed only updated resources/chunks using status + hashes

---

## C) Retrieval Design (Hybrid)

Implemented service:
- `src/modules/roadmap/roadmap-retrieval.service.ts`

### Retrieval pipeline
1. Structured candidate fetch from `resources` with metadata filters
2. Keyword retrieval via `roadmap_keyword_search`
3. Semantic retrieval via `roadmap_semantic_search` (if embeddings configured)
4. Fusion using weighted Reciprocal Rank Fusion
5. Lightweight rerank boost for required-skill lexical alignment
6. Confidence scoring from top score, margin, and evidence density
7. Weak-evidence if confidence low or insufficient candidates

### Weak-evidence behavior
- Returns:
  - `weakEvidence: true`
  - `reason: "insufficient reliable sources"`
- Planner propagates this to roadmap response with no hallucinated resource links

---

## D) Planner Design

Implemented service:
- `src/modules/roadmap/roadmap-planner.service.ts`

### Planner logic
1. Resolve career by `career_id` or role text
2. Build backbone skills from:
   - `careers.required_skills`
   - `careers.preferred_interests`
   - `careers.typical_traits`
3. Load user signals from:
   - profile skills
   - latest CV extracted skills/interests
   - request profile payload
4. Gap analysis: `missing = required - existing`
5. Ordering:
   - Prefer `role_skill_map` priority order
   - Apply explicit sequence constraints (`before`, `after`)
6. For each missing skill:
   - Hybrid retrieve best resources
   - Create step with requested output contract fields
7. Confidence:
   - per-step confidence from retrieval
   - overall confidence from step confidence + source diversity
8. If weak evidence, set message `insufficient reliable sources`

---

## E) API Design (Implemented)

Extended `RoadmapController`:
- `POST /roadmap/plan`
- `POST /roadmap/resources/search`
- `POST /roadmap/refresh-provider`

New DTO/type contracts:
- `src/modules/roadmap/roadmap-rag.types.ts`
  - `PlanRoadmapDto`
  - `SearchResourcesDto`
  - `RefreshProviderDto`
  - response contracts

Module wiring:
- `RoadmapModule` now provides:
  - `RoadmapRetrievalService`
  - `RoadmapPlannerService`
  - `RoadmapRefreshService`

---

## F) Python Ingestion Worker Design

Scaffold location:
- `Mobile/server/ingestion_worker/*`

Responsibilities split
- `providers/*`: source-specific crawling
- `normalizer.py`: canonical resource metadata
- `dedup.py`: URL/content dedup
- `chunker.py`: deterministic chunking
- `embedder.py`: embeddings
- `supabase_store.py`: upserts into Supabase
- `pipeline.py`: orchestration
- `main.py`: monthly/on-demand execution entrypoint

V1 policy
- trusted curated providers only
- no broad live web search in roadmap runtime path

---

## G) Roadmap Output Contract (Mobile-facing)

The planner returns:

```json
{
  "success": true,
  "mode": "stored_kb_v1",
  "target_role": "Frontend Developer",
  "career_id": "uuid-or-null",
  "confidence": 0.78,
  "weak_evidence": false,
  "message": null,
  "steps": [
    {
      "skill_name": "React",
      "why_it_matters": "React is a core requirement for Frontend Developer and directly impacts job readiness.",
      "difficulty": "intermediate",
      "estimated_duration_hours": 30,
      "prerequisites": ["JavaScript"],
      "resource_id": "uuid",
      "resource_title": "React Official Docs",
      "resource_type": "docs",
      "free_or_paid": "free",
      "language": "en",
      "level": "beginner",
      "provider": "react.dev",
      "source_url": "https://react.dev/",
      "confidence_score": 0.74,
      "order_index": 1
    }
  ],
  "metadata": {
    "required_skills": ["..."],
    "existing_skills": ["..."],
    "missing_skills": ["..."],
    "evidence_summary": {
      "strong_steps": 6,
      "weak_steps": 1,
      "source_count": 6
    }
  }
}
```

---

## Notes and assumptions
- V1 avoids runtime live web search by design.
- Semantic retrieval requires embedding generation credentials; keyword + structured remains functional without it.
- The planner never fabricates source links: weak-evidence steps may intentionally return null resource fields.
