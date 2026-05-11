# FastAPI Backend - Smart Career Recommendation System

This is the FastAPI-based backend for the Smart Career Recommendation System, migrated from the original NestJS implementation.

## Overview

The FastAPI backend provides all the functionality of the original NestJS backend with improved performance, better async support, and Python's rich ecosystem for AI/ML integration.

## Features

- **Authentication**: Supabase JWT token validation
- **Quiz System**: 10-question adaptive quiz with DISC profile generation
- **Career Recommendations**: AI-powered career matching with deterministic scoring
- **CV Analysis**: PDF upload and AI-powered skill extraction
- **Roadmaps**: Personalized career and learning roadmaps
- **AI Integration**: OpenRouter integration for LLM-powered features
- **Caching**: Redis-backed caching with in-memory fallback
- **Queue System**: Background job processing for async tasks

## Architecture

```
fastapi_backend/
├── app/
│   ├── api/
│   │   └── v1/              # Versioned API routes
│   ├── core/                # Core services (auth, cache, AI, etc.)
│   ├── modules/             # Domain modules (auth, quiz, career, etc.)
│   ├── workers/             # Background task workers
│   └── main.py              # FastAPI application entry point
├── tests/                   # Test suite (unit, integration, e2e)
├── migrations/              # Database migrations
└── pyproject.toml          # Project dependencies
```

## Installation

### Prerequisites

- Python 3.11+
- Redis (optional, for caching and queue)
- Supabase account
- OpenRouter API key (optional, for AI features)

### Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run the application:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

## Configuration

Key environment variables (see `.env.example`):

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `SUPABASE_ANON_KEY`: Supabase anon key
- `OPENROUTER_API_KEY`: OpenRouter API key (for AI features)
- `REDIS_URL`: Redis connection URL (optional)
- `REDIS_DISABLED`: Set to `true` to disable Redis

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3000/docs
- ReDoc: http://localhost:3000/redoc

## Key Differences from NestJS

### Advantages

1. **Performance**: FastAPI's async-first design provides better performance
2. **Type Safety**: Pydantic models provide excellent type checking
3. **Python Ecosystem**: Access to rich Python AI/ML libraries
4. **Simplicity**: Less boilerplate than NestJS
5. **Development Speed**: FastAPI's automatic docs and validation speed up development

### Trade-offs

1. **Dependency Injection**: Less sophisticated than NestJS's DI system
2. **Decorators**: Fewer built-in decorators for common patterns
3. **Maturity**: NestJS has more enterprise patterns built-in

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/e2e/test_health.py
```

## Development

### Code Style

- Use `black` for formatting
- Use `ruff` for linting
- Use `mypy` for type checking

```bash
# Format code
black app/

# Lint
ruff app/

# Type check
mypy app/
```

### Adding New Features

1. Create Pydantic models in appropriate `schemas.py`
2. Implement service layer in `modules/<domain>/service.py`
3. Add routes in `modules/<domain>/router.py`
4. Write tests in `tests/`
5. Update documentation

## Migration Status

### Completed

- ✅ Core infrastructure (FastAPI app, config, logging)
- ✅ Database service (Supabase integration)
- ✅ Cache service (Redis with fallback)
- ✅ Auth service (JWT validation, user profiles)
- ✅ AI orchestrator (OpenRouter integration)
- ✅ Quiz service (adaptive quiz, DISC profiles)
- ✅ Career service (deterministic matching, AI explanations)
- ✅ CV service (PDF upload, AI analysis)
- ✅ Roadmap service (legacy + personalized roadmaps)
- ✅ Learning roadmap service (skill-based paths)
- ✅ Queue service (background job processing)
- ✅ Worker tasks (CV analysis, AI processing, roadmap generation)
- ✅ API routers with proper endpoints
- ✅ Comprehensive tests

### Known Limitations

1. Some AI features use simplified implementations (can be enhanced)
2. Worker queue uses RQ (can be upgraded to Celery for production)
3. Database models are minimal (expand based on needs)
4. Authentication uses simple token validation (enhance with middleware)

## Production Deployment

### Using Gunicorn

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
```

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "--bind", "0.0.0.0:3000"]
```

## Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure type checking passes
5. Run full test suite before submitting

## License

Same as the main Smart Career Recommendation System project.

## Support

For issues or questions, refer to the main project documentation or contact the development team.