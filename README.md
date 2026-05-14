# Smart Career Recommendation System

An AI-powered full-stack career guidance platform that helps users discover their ideal career paths, analyze their CVs, build personalized learning roadmaps, connect with mentors, and find relevant job opportunities.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The **Smart Career Recommendation System** is a comprehensive platform designed to bridge the gap between job seekers and their dream careers. It leverages modern AI (LLMs, embeddings, vector search) to provide personalized career recommendations, skill gap analysis, curated learning roadmaps, and mentorship connections.

The system is composed of four independent but integrated projects:

| Project | Technology | Port | Role |
|---|---|---|---|
| **Admin Dashboard** | Next.js 16 + TypeScript | 3000 | Web-based admin panel for managing users, careers, skills, mentors, and analytics |
| **Mobile App** | React Native (Expo) + TypeScript | 8081 (Expo) | Cross-platform mobile app for end-users |
| **FastAPI Backend** | Python 3.11 + FastAPI | 3000 | Main API server: auth, career matching, CV analysis, roadmaps, chatbot |
| **Job Spy Server** | Python + FastAPI | 8000 | Standalone job scraping microservice |

Both the mobile app and admin dashboard share a single **Supabase** PostgreSQL database with Row Level Security (RLS).

---

## System Architecture

```
+------------------+       +------------------+
|   Admin Dashboard |       |   Mobile App      |
|   (Next.js 16)   |       |   (Expo / RN)     |
|   Port: 3000     |       |   Port: 8081      |
+--------+---------+       +--------+---------+
         |                          |
         |  HTTP / REST             |  HTTP / REST
         |  NextAuth JWT            |  Supabase JWT
         v                          v
+--------+--------------------------------------+
|           FastAPI Backend (Port: 3000)         |
|  - Auth, Career, CV, Quiz, Roadmap, Chatbot   |
|  - Hybrid RAG Pipeline (Keyword + Vector)     |
|  - AI Orchestrator (OpenRouter + Ollama)      |
+--------+--------------------------------------+
         |
         |  Service Role Key
         v
+--------+--------------------------------------+
|        Supabase (PostgreSQL + Auth)            |
|  - Row Level Security (RLS) on all tables       |
|  - pgvector for semantic search               |
|  - HNSW index for fast ANN retrieval          |
+------------------------------------------------+
```

---

## Tech Stack

### Frontend
- **Next.js 16** (App Router, React 19, React Compiler)
- **Tailwind CSS v4** + Radix UI + shadcn/ui pattern
- **TanStack Query v5** for server-state caching
- **React Hook Form + Zod v4** for forms and validation
- **NextAuth.js v5** (beta) for admin authentication
- **Recharts** for analytics dashboards

### Mobile
- **Expo SDK 54** + **React Native 0.81**
- **TypeScript** (strict mode)
- **Gluestack UI** for themed native components
- **React Navigation v7** (stack + tabs + top-tabs)
- **TanStack Query v5**
- **Supabase Auth** with AsyncStorage persistence
- **React Hook Form + Zod v4**

### Backend
- **FastAPI 0.115+** + **Uvicorn**
- **Python 3.11+**
- **Pydantic v2** + `pydantic-settings`
- **Supabase** async client + **SQLAlchemy 2.x** + **Alembic**
- **Redis 5+** for caching (with in-memory fallback)
- **LangGraph + LangChain** for chatbot agent graph
- **OpenRouter** (general AI) + **Ollama Cloud** (chatbot only)
- **pgvector** (PostgreSQL extension) for semantic search
- **pytest** + **ruff** + **mypy**

### Data & AI
- **PostgreSQL** via Supabase
- **OpenAI / OpenRouter Embeddings** (`text-embedding-3-small`)
- **HNSW index** for Approximate Nearest Neighbor (ANN) search
- **Hybrid RAG**: keyword search (`tsvector`) + vector search (`pgvector`)
- **Web fallback**: DuckDuckGo for live course search when RAG is weak
- **python-jobspy** for job board scraping

---

## Features

### For End Users (Mobile App)
- **Authentication**: Sign up / Sign in with Supabase Auth
- **Career Quiz**: AI-powered personality and skill quiz to discover matching careers
- **Career Explorer**: Browse careers with demand level, salary, and growth data
- **CV Analysis**: Upload a PDF CV and get AI-powered skill extraction, ATS scoring, and improvement tips
- **Learning Roadmaps**: Personalized step-by-step learning plans with curated courses and certifications
- **Hybrid RAG Pipeline**: Semantic + keyword search across a curated knowledge base of courses, docs, and videos
- **Mentor Matching**: Connect with mentors, book 1-on-1 sessions, and join specialty group chats
- **Job Listings**: Browse scraped job listings from Indeed, LinkedIn, and more
- **Notifications**: Push notifications for session reminders and chat messages

### For Admins (Web Dashboard)
- **Dashboard Overview**: Analytics, charts, and KPIs
- **User Management**: View, manage, and monitor user accounts
- **Career Management**: CRUD for careers, skills, and career-skill mappings
- **Course / Resource Management**: Manage the curated RAG knowledge base
- **Mentor Management**: Approve mentors, manage sessions, and moderate group chats
- **Recommendation Oversight**: Review AI-generated recommendations and roadmaps

### AI & Backend Capabilities
- **CV Skill Extraction**: Parse PDFs with `pdfminer` + LLM extraction
- **Career Matching**: Combine quiz results + CV analysis + skill gap computation
- **Hybrid RAG Roadmap Generation**:
  1. AI generates an ordered skill sequence for the target role
  2. Hybrid search (keyword + vector) retrieves stored resources per skill
  3. Evidence scoring picks the best primary + backup resources
  4. Web search (DuckDuckGo) fills gaps when RAG confidence is low
  5. Enriched response with badges, metadata, and diagnostics
- **Chatbot Agent**: LangGraph-based conversational agent with memory, routing, and tool use
- **Ingestion Pipeline**: Automated content ingestion with chunking, embedding, deduplication, and storage

---

## Project Structure

```
SmartCareerRecommendationISS/
├── admin-dashboard/          # Next.js 16 admin panel
│   ├── app/                  # App Router pages
│   ├── components/           # Reusable UI (shadcn/ui, layout, tables, forms)
│   ├── hooks/                # TanStack Query hooks
│   ├── services/             # API clients, Supabase utils
│   ├── lib/                  # Utilities, Supabase clients
│   ├── types/                # TypeScript definitions
│   └── providers/            # Query, Theme, Auth providers
│
├── Mobile/                   # React Native (Expo) mobile app
│   ├── src/
│   │   ├── api/              # API service layer
│   │   ├── auth/             # Authentication provider & hooks
│   │   ├── features/         # Domain modules (careers, chatbot, cv, jobs, ...)
│   │   ├── navigation/       # React Navigation setup
│   │   ├── screens/          # UI screen components
│   │   ├── theme/            # Gluestack UI theme config
│   │   └── types/            # TypeScript definitions
│   └── server/               # Standalone FastAPI job-spy server (Port 8000)
│       ├── main.py           # JobSpy scraper API entry point
│       ├── scrapers/         # Custom scraper modules
│       └── ingestion_worker/ # Background ingestion pipeline
│
├── backend/                  # FastAPI backend (Port 3000)
│   ├── app/
│   │   ├── api/v1/           # API router composition
│   │   ├── api/endpoints/    # New MVC routers: auth, career, cv, quiz
│   │   ├── core/             # Shared services (auth, cache, AI, DB, middleware)
│   │   ├── modules/          # Domain modules: career, cv, jobs, roadmap, quiz, mentors
│   │   ├── agents/chatbot/   # Chatbot agent router & LangGraph pipeline
│   │   ├── ingestion/        # Content ingestion pipeline (chunker, dedup, embedder, store)
│   │   └── workers/tasks/    # Background tasks (cv_analysis, ai_processing, roadmap)
│   ├── tests/                # pytest suite: e2e, integration, unit
│   ├── migrations/             # Alembic migrations
│   └── Makefile              # Common commands
│
├── DATABASE_SCHEMA.md        # Complete Supabase/PostgreSQL schema documentation
├── CLAUDE.md                 # Project-specific developer guide for Claude Code
└── README.md                 # This file
```

---

## Getting Started

> **Prerequisites**: Node.js 20+, Python 3.11+, Redis (optional), and a Supabase project.

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/SmartCareerRecommendationISS.git
cd SmartCareerRecommendationISS
```

### 2. Set up the Backend

```bash
cd backend
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies (Makefile handles numpy/jobspy ordering)
make install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase, OpenRouter, and Redis credentials

# Run database migrations
alembic upgrade head

# Start the server
make dev
```

### 3. Set up the Mobile App

```bash
cd ../Mobile

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL, anon key, and backend URLs

# Start Expo
npm start
# Press 'a' for Android emulator, 'i' for iOS simulator
```

### 4. Set up the Admin Dashboard

```bash
cd ../admin-dashboard

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API URL and NextAuth secret

# Run dev server
npm run dev
```

### 5. (Optional) Job Spy Server

```bash
cd ../Mobile/server

# Install dependencies
pip install -r requirements.txt

# Start the scraper API
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Environment Variables

Each project has its own `.env` requirements. See the `.env.example` files in each folder for templates.

### Backend (`backend/.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
OPENROUTER_API_KEY=sk-or-v1-...
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=your-jwt-secret
```

### Mobile (`Mobile/.env`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_JOB_API_URL=http://localhost:3000
```

### Admin Dashboard (`admin-dashboard/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
```

> **Never commit `.env` or `.env.local` files to version control.** They are already listed in `.gitignore`.

---

## API Documentation

When the FastAPI backend is running, interactive API documentation is automatically available at:

- **Swagger UI**: `http://localhost:3000/docs`
- **ReDoc**: `http://localhost:3000/redoc`

### Main Endpoint Groups

| Prefix | Description |
|---|---|
| `POST /auth/validate` | Validate Supabase JWT tokens |
| `POST /cv/upload` | Upload a PDF CV for analysis |
| `GET /careers` | List careers with filtering |
| `POST /quiz/submit` | Submit quiz answers and get recommendations |
| `GET /roadmap` | Generate a learning roadmap for a career |
| `POST /roadmap/hybrid` | Generate a Hybrid-RAG enriched roadmap |
| `POST /chatbot` | Chat with the AI career assistant |
| `GET /mentors` | List available mentors |

---

## Screenshots

> *Screenshots will be added here. To contribute screenshots, please open a PR with images placed in `/.github/screenshots/`.*

---

## Contributing

Contributions are welcome! This project follows a monorepo workflow. Please open feature branches and use conventional commits.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional format: `git commit -m "feat: add new analytics chart"`
4. Push to your fork and open a Pull Request

Please ensure your code passes linting and tests in the relevant project directory:
- **Backend**: `make lint && make test`
- **Admin Dashboard**: `npm run lint`
- **Mobile**: `npm run lint`

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

- [Supabase](https://supabase.com/) for the open-source Firebase alternative
- [OpenRouter](https://openrouter.ai/) for unified LLM API access
- [JobSpy](https://github.com/cullenwatson/JobSpy) for job board scraping
- [Expo](https://expo.dev/) for the React Native development toolchain
- [FastAPI](https://fastapi.tiangolo.com/) for the modern Python web framework

---

<p align="center">Built with care for job seekers everywhere.</p>
