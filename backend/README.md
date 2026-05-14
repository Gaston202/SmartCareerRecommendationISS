# Smart Career Recommendation — FastAPI Backend

The main API server for the Smart Career Recommendation System. Built with **FastAPI** and **Python 3.11+**, it powers career matching, CV analysis, hybrid RAG roadmap generation, mentor management, and the AI chatbot agent.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [The Hybrid RAG Pipeline](#the-hybrid-rag-pipeline)
- [Database](#database)
- [Testing](#testing)
- [Linting & Formatting](#linting--formatting)
- [Background Workers](#background-workers)
- [Ingestion Pipeline](#ingestion-pipeline)
- [Troubleshooting](#troubleshooting)

---

## Overview

This backend serves as the central nervous system of the platform. It handles:

- **Authentication**: Validating Supabase JWT tokens across mobile and web clients
- **Career Engine**: Matching users to careers based on quiz results, CV skills, and AI analysis
- **CV Processing**: PDF parsing, skill extraction via LLM, ATS scoring, and improvement recommendations
- **Hybrid RAG Roadmaps**: Generating personalized learning plans using keyword + vector search over a curated knowledge base, with web search fallback
- **Chatbot Agent**: A LangGraph-based conversational AI with memory, routing, and tool use
- **Mentorship**: Mentor profiles, session booking, group chats, and availability management
- **Content Ingestion**: Automated pipeline for scraping, chunking, embedding, and storing learning resources

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Framework | FastAPI 0.115+ + Uvicorn |
| Language | Python 3.11+ |
| Validation | Pydantic v2 + `pydantic-settings` |
| Database | Supabase (PostgreSQL) + SQLAlchemy 2.x |
| Migrations | Alembic |
| Auth | `python-jose` + `passlib[bcrypt]` + Supabase JWT |
| Cache | Redis 5+ (async) with in-memory fallback |
| AI / LLM | OpenRouter (general) + Ollama Cloud (chatbot only) |
| Embeddings | OpenAI `text-embedding-3-small` via OpenRouter |
| Vector DB | pgvector (PostgreSQL extension) + HNSW index |
| Agent Framework | LangGraph + LangChain |
| HTTP Client | httpx (async) |
| Testing | pytest + pytest-asyncio + pytest-cov + pytest-mock |
| Linting | ruff (line length 100) + mypy + black |
| Queue | RQ (Redis Queue) for background jobs |

---

## Architecture

The backend uses a modular, domain-driven structure. Instead of a full DI container, it uses singleton-like services instantiated in `app/core/dependencies.py` and injected via FastAPI's `Depends()`.

```
Request
    → Middleware (CORS, logging, process-time header, exception handlers)
    → JWT Validation (app/core/auth.py)
    → API Router (app/api/v1/router.py)
        → New MVC Endpoints (app/api/endpoints/)
            auth, career, cv, quiz
        → Legacy Modules (app/modules/)
            roadmap, learning_roadmap, mentors, ingestion, jobs
        → Chatbot Agent (app/agents/chatbot/)
    → Service Layer (business logic)
    → Database / Cache / AI / Queue
```

---

## Features

### Authentication
- Validates Supabase JWT tokens via `python-jose`
- Extracts user identity from `Authorization: Bearer <token>` headers
- Supports both `anon` and `service_role` Supabase keys

### Career Module
- Career CRUD with skill mappings
- Career matching algorithm combining quiz results, CV skills, and demand data
- Salary and growth analytics

### CV Module
- PDF upload endpoint (10 MB limit, MIME validated)
- Async CV analysis pipeline: `pdfminer` + `PyPDF2` for text extraction, LLM for skill extraction
- ATS (Applicant Tracking System) scoring and improvement suggestions
- Skill confirmation workflow (users can edit/remove AI-extracted skills)

### Quiz Module
- Personality and skill assessment quizzes
- AI-generated career recommendations based on answers
- Result storage and history tracking

### Roadmap Module
- **Hybrid RAG Learning Roadmaps**: The flagship feature
  1. AI generates an ordered skill sequence for the target role
  2. Hybrid keyword + vector search retrieves stored resources per skill
  3. Evidence scoring selects the best primary and backup resources
  4. DuckDuckGo web search fills gaps when RAG confidence is low
  5. Returns an enriched roadmap with courses, certifications, and metadata
- Fallback to `role_skill_map` database table when AI is unavailable
- Roadmap caching in Redis for 24 hours

### Chatbot Agent (LangGraph)
- **State-based agent graph** with nodes for routing, Q&A, profile analysis, booking, and general chat
- **Memory**: Conversation history stored per user
- **Tools**: Profile lookup, mentor search, general knowledge, booking availability
- **Defense layer**: Input sanitization and safety checks
- Strictly uses **Ollama Cloud** (`deepseek-v4-flash:cloud`) for chatbot responses

### Mentors Module
- Mentor application and approval workflow
- Session booking with time slot management
- Group chat rooms organized by specialty
- Review and rating system

### Jobs Module
- Router exists but is **not currently wired** into the main `api_router`
- Intended to proxy or integrate with the standalone Job Spy Server

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory, CORS, middleware
│   ├── api/
│   │   ├── v1/router.py        # API router composition
│   │   ├── endpoints/          # New MVC routers
│   │   │   ├── auth.py         # Token validation, profile
│   │   │   ├── career.py       # Career CRUD and matching
│   │   │   ├── cv.py           # CV upload and analysis
│   │   │   └── quiz.py         # Quiz submission and results
│   │   ├── schemas/            # Pydantic request/response models
│   │   └── deps.py             # FastAPI dependency providers
│   │
│   ├── core/                   # Shared services
│   │   ├── config.py           # Pydantic-settings (env vars)
│   │   ├── database.py         # Supabase async client wrapper
│   │   ├── auth.py             # JWT validation against Supabase
│   │   ├── ai_orchestrator.py  # OpenRouter + Ollama AI clients
│   │   ├── cache.py            # Redis + in-memory cache service
│   │   ├── queue.py            # Background job queue (RQ)
│   │   ├── middleware.py       # Exception handlers, logging middleware
│   │   └── logging.py          # Structured logging setup
│   │
│   ├── modules/                # Domain modules
│   │   ├── career/             # Career service, models, schemas
│   │   ├── cv/                 # CV service, analysis logic
│   │   ├── jobs/               # Job listing integration (legacy)
│   │   ├── learning_roadmap/  # Learning roadmap generation
│   │   ├── mentors/            # Mentor profiles, sessions, chats
│   │   ├── quiz/               # Quiz logic and scoring
│   │   ├── roadmap/            # Core roadmap module
│   │   │   ├── hybrid_service.py   # Hybrid-RAG orchestrator
│   │   │   ├── retrieval.py      # Keyword + vector search
│   │   │   ├── evidence.py       # Evidence scoring
│   │   │   ├── skill_gap.py      # Skill gap computation
│   │   │   ├── web_search.py     # DuckDuckGo fallback
│   │   │   └── badges.py         # Resource presentation
│   │   └── shared/             # Shared module utilities
│   │
│   ├── agents/
│   │   └── chatbot/            # LangGraph chatbot agent
│   │       ├── router.py
│   │       ├── service.py
│   │       ├── graph/
│   │       │   ├── builder.py      # Graph construction
│   │       │   ├── state.py        # Agent state schema
│   │       │   └── nodes/          # Graph nodes
│   │       │       ├── router.py
│   │       │       ├── qa.py
│   │       │       ├── profile.py
│   │       │       ├── booking.py
│   │       │       ├── general.py
│   │       │       └── llm_response.py
│   │       ├── orchestrator/     # Agent orchestration
│   │       │   ├── orchestrator.py
│   │       │   ├── config.py
│   │       │   ├── memory.py
│   │       │   ├── defense.py
│   │       │   └── trace.py
│   │       ├── tools/            # Agent tools
│   │       │   ├── profile.py
│   │       │   ├── search.py
│   │       │   ├── booking.py
│   │       │   └── general.py
│   │       └── schemas/          # Agent schemas
│   │
│   ├── ingestion/              # Content ingestion pipeline
│   │   ├── pipeline.py         # Main ingestion orchestrator
│   │   ├── chunker.py          # Text chunking (500 tokens, 50 overlap)
│   │   ├── embedder.py         # OpenRouter/OpenAI embedding client
│   │   ├── dedup.py            # Embedding-based duplicate detection
│   │   ├── normalizer.py       # Resource metadata normalization
│   │   ├── store.py            # Upsert resources + chunks to DB
│   │   ├── router.py           # Ingestion job API endpoints
│   │   └── providers/          # Data source providers
│   │       ├── web.py
│   │       ├── coursera.py
│   │       └── youtube.py
│   │
│   └── workers/tasks/          # Background task definitions
│       ├── cv_analysis.py
│       ├── ai_processing.py
│       └── roadmap_generation.py
│
├── tests/                    # pytest test suite
│   ├── e2e/                  # End-to-end tests (health, auth, roadmap)
│   ├── integration/          # Integration tests (quiz results)
│   └── unit/                 # Unit tests (AI orchestrator, quiz service)
│
├── migrations/               # Alembic database migrations
│   └── versions/
│
├── scripts/                  # Utility scripts
│   ├── seed_rag_resources.py # Seed curated resources for RAG
│   └── seed_role_skills.py   # Seed role-skill mappings
│
├── pyproject.toml            # Project metadata and tool config
├── requirements.txt          # Production + dev dependencies
├── Makefile                  # Common commands (install, dev, lint, test)
└── .env                      # Environment variables (not in git)
```

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Redis** (optional — backend falls back to in-memory cache if Redis is unavailable)
- A **Supabase** project with the schema applied (see `../DATABASE_SCHEMA.md`)
- An **OpenRouter** API key (for AI features)

### Installation

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate          # Windows

# Install dependencies
# The Makefile handles numpy/jobspy ordering to avoid Python 3.14 wheel issues
make install

# Or manually:
# pip install "numpy>=2.0.0" "pandas>=2.2.0"
# pip install python-jobspy --no-deps
# pip install -r requirements.txt
```

### Environment Setup

```bash
# Copy the environment template (or create manually)
# Edit .env with your actual credentials
cp .env.example .env
```

Key variables:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
OPENROUTER_API_KEY=sk-or-v1-...
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=your-secure-secret
```

### Database Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "feat: add new table"
```

### Running the Server

```bash
# Development (auto-reload)
make dev
# Equivalent to: uvicorn app.main:app --reload --host 0.0.0.0 --port 3000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 3000
```

Once running, interactive docs are available at:
- **Swagger UI**: `http://localhost:3000/docs`
- **ReDoc**: `http://localhost:3000/redoc`
- **Health Check**: `GET http://localhost:3000/health`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service role key for DB operations |
| `SUPABASE_ANON_KEY` | Yes | — | Anon key for JWT validation |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key for LLM calls |
| `OPENROUTER_URL` | No | `https://openrouter.ai/api/v1/chat/completions` | Chat completions endpoint |
| `OPENROUTER_EMBEDDINGS_URL` | No | `https://openrouter.ai/api/v1/embeddings` | Embeddings endpoint |
| `OPENAI_API_KEY` | No | — | Optional direct OpenAI key for embeddings |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis connection string |
| `REDIS_DISABLED` | No | `false` | Set to `true` to disable Redis |
| `JWT_SECRET` | Yes | — | Secret for local JWT signing |
| `JWT_ALGORITHM` | No | `HS256` | JWT algorithm |
| `OLLAMA_API_KEY` | No | — | Ollama Cloud API key |
| `OLLAMA_HOST` | No | `https://ollama.com` | Ollama host |
| `OLLAMA_CHATBOT_MODEL` | No | `deepseek-v4-flash:cloud` | Chatbot model |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `ROADMAP_EMBEDDING_MODEL` | No | `openai/text-embedding-3-small` | Primary embedding model |

See `app/core/config.py` for the complete list.

---

## API Endpoints

### New MVC Endpoints (`/api/v1`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/validate` | Validate Supabase JWT |
| `POST` | `/api/v1/auth/profile` | Get/update user profile |
| `POST` | `/api/v1/cv/upload` | Upload CV PDF for analysis |
| `GET` | `/api/v1/cv/status/{id}` | Check CV analysis status |
| `GET` | `/api/v1/careers` | List careers |
| `GET` | `/api/v1/careers/{id}` | Get career details |
| `POST` | `/api/v1/quiz/submit` | Submit quiz and get recommendations |

### Legacy Module Endpoints (`/api/v1`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/roadmap` | Generate roadmap |
| `POST` | `/api/v1/roadmap/hybrid` | Generate Hybrid-RAG roadmap |
| `GET` | `/api/v1/learning-roadmap` | Learning roadmap endpoints |
| `GET` | `/api/v1/mentors` | List mentors |
| `POST` | `/api/v1/mentors/book` | Book a mentor session |
| `POST` | `/api/v1/chatbot` | Chat with the AI agent |
| `POST` | `/api/v1/ingestion/jobs` | Create ingestion job |
| `GET` | `/api/v1/ingestion/jobs/{id}` | Get ingestion job status |

---

## The Hybrid RAG Pipeline

The flagship feature of this backend is the **Hybrid RAG (Retrieval-Augmented Generation)** pipeline for learning roadmaps.

### How it works

1. **Skill Generation**: The AI orchestrator generates an ordered list of skills needed for the target career. If the AI is unavailable, it falls back to the `role_skill_map` database table.

2. **Hybrid Retrieval**: For each skill, the system runs two searches in parallel:
   - **Keyword Search**: PostgreSQL full-text search (`tsvector` / `ts_rank_cd`) over resource titles, descriptions, tags, and chunk text.
   - **Vector Search**: `pgvector` cosine similarity search over 1536-dimensional embeddings stored in `resource_chunks`.

3. **Fusion & Ranking**: Results from both searches are merged and scored with a weighted formula:
   - `final_score = 0.30 * keyword_score + 0.50 * vector_score + 0.20 * tag_score`
   - A relevance guard filters out vector drift by requiring token overlap in titles or tags.

4. **Evidence Scoring**: The `RoadmapEvidenceService` scores candidates using title relevance (40%), tag match (30%), chunk overlap (20%), and retrieval score (10%). It assigns a confidence level: **high**, **medium**, or **low**.

5. **Web Fallback**: If confidence is low, the system queries DuckDuckGo for real online courses and certifications, merging them into the result set.

6. **Assembly & Cache**: The final roadmap is assembled with primary resources, backups, certifications, badges, and diagnostics. It is cached in Redis for 24 hours under a key derived from the role and user skills.

### Key Files

- `app/modules/roadmap/hybrid_service.py` — Orchestrator
- `app/modules/roadmap/retrieval.py` — Hybrid keyword + vector search
- `app/modules/roadmap/evidence.py` — Evidence scoring
- `app/ingestion/pipeline.py` — Content ingestion into the knowledge base

---

## Database

The backend uses **Supabase PostgreSQL** as its primary database.

### Key Tables

| Table | Purpose |
|---|---|
| `auth.users` | Supabase Auth user records |
| `users` | Extended user profiles and roles |
| `careers` | Career definitions with salary, demand, growth |
| `cvs` | Uploaded CV metadata |
| `cv_analysis` | AI analysis results for each CV |
| `user_quiz_sessions` | Quiz submissions and answers |
| `recommendations` | AI-generated career recommendations |
| `resources` | Curated learning resources (courses, articles, videos) |
| `resource_chunks` | Chunked content with pgvector embeddings |
| `role_skill_map` | Fallback mapping of roles to required skills |
| `skill_resource_map` | Junction table linking skills to best resources |
| `ingestion_jobs` | Background ingestion job tracking |
| `mentors` | Mentor profiles |
| `mentor_sessions` | Booked sessions |
| `group_chats` | Specialty group chat rooms |
| `group_chat_members` | Group chat memberships |

### PostgreSQL Functions

- `roadmap_keyword_search(query_text, limit_count, filters)` — Full-text search over resources
- `roadmap_semantic_search(query_embedding, limit_count, filters)` — Vector similarity search using HNSW index
- `embedding_duplicate_check(query_embedding, max_distance)` — Near-duplicate detection via cosine distance

See `../DATABASE_SCHEMA.md` for the complete schema, relationships, and RLS policies.

---

## Testing

```bash
# Run all tests
make test
# Equivalent to: pytest

# Run specific test suites
pytest tests/e2e/              # End-to-end tests
pytest tests/integration/ -v   # Integration tests (verbose)
pytest tests/unit/             # Unit tests
pytest -k test_health          # Filter by name

# With coverage
pytest --cov=app --cov-report=html
```

---

## Linting & Formatting

```bash
# Check linting
make lint
# Equivalent to: ruff check app tests

# Auto-fix issues
make format
# Equivalent to: ruff check --fix app tests
```

Configuration is in `pyproject.toml`:
- Line length: 100
- Target Python version: 3.11
- Enabled rules: E, F, I, UP, B

---

## Background Workers

Background tasks are dispatched via RQ (Redis Queue):

- **CV Analysis** (`app/workers/tasks/cv_analysis.py`) — Async skill extraction from uploaded PDFs
- **AI Processing** (`app/workers/tasks/ai_processing.py`) — General AI background jobs
- **Roadmap Generation** (`app/workers/tasks/roadmap_generation.py`) — Async roadmap creation for heavy requests

To run a worker:
```bash
rq worker --with-scheduler
```

---

## Ingestion Pipeline

The ingestion system populates the RAG knowledge base with curated resources.

### Flow

```
Ingestion Job (via API or script)
    → Provider fetch (web, Coursera, YouTube)
    → normalize_resource()       # Clean metadata
    → chunk_text()               # 500-token chunks, 50-token overlap
    → embed_texts()            # OpenRouter/OpenAI embeddings
    → has_embedding_duplicate()  # Skip if cosine sim > 0.97
    → upsert_resource_with_chunks()  # Save to DB
    → invalidate roadmap cache
```

### Seeding Resources

```bash
# Seed curated resources for RAG
python scripts/seed_rag_resources.py --run-now

# Seed specific skills only
python scripts/seed_rag_resources.py --skills python react docker --run-now
```

---

## Troubleshooting

### `python-jobspy` fails to install
The Makefile handles the install order to avoid numpy wheel issues:
```bash
make install
```

### Redis connection errors
Set `REDIS_DISABLED=true` in `.env` to use in-memory caching instead:
```env
REDIS_DISABLED=true
```

### Embedding models return 401/403
The system has automatic model fallback. If a model rejects your key, it tries the next fallback model. If all fail, it falls back to Ollama local embeddings (if configured).

### Alembic migration fails
Ensure the `pgvector` extension is enabled in your Supabase project:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Port conflicts
The backend defaults to port `3000`, which conflicts with the Admin Dashboard. In local development, run one on a different port:
```bash
uvicorn app.main:app --reload --port 3001
```

---

## Related Projects

- [Mobile App](../Mobile/) — React Native (Expo) client
- [Admin Dashboard](../admin-dashboard/) — Next.js web admin panel
- [Job Spy Server](../Mobile/server/) — Standalone Python job scraping service

---

<p align="center">Powered by FastAPI, PostgreSQL, and AI.</p>
