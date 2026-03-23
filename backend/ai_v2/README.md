# AI v2 Module - Smart Career Recommendation System

> A clean, scalable, production-ready multi-agent AI system for generating personalized career recommendations using Retrieval-Augmented Generation (RAG).

## 📋 Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [Module Reference](#module-reference)
- [Development Roadmap](#development-roadmap)
- [Integration Guide](#integration-guide)

## 🎯 Overview

The AI v2 module provides a modular, extensible framework for career recommendations through:

- **Multi-Agent System**: Specialized agents for different tasks (profile analysis, CV parsing, career matching, skill gap analysis, roadmap generation)
- **RAG (Retrieval-Augmented Generation)**: External knowledge integration for job market data and learning resources
- **Type Safety**: Full Pydantic schema validation for inputs and outputs
- **Clean Architecture**: Separation of concerns with clear module boundaries
- **Production Ready**: Logging, error handling, configuration management, and feature flags

## 📁 Project Structure

```
backend/ai_v2/
├── __init__.py                 # Package exports
├── config.py                   # Configuration and environment variables
├── main_pipeline.py            # High-level API entry point
├── orchestrator.py             # Agent orchestration and sequencing
│
├── agents/                     # Multi-agent system
│   ├── __init__.py
│   ├── base_agent.py           # Abstract base class for all agents
│   ├── profile_agent.py        # User profile analysis
│   ├── cv_agent.py             # CV document parsing
│   ├── career_agent.py         # Career recommendations
│   ├── gap_agent.py            # Skill gap analysis
│   └── roadmap_agent.py        # Learning roadmap generation
│
├── rag/                        # Retrieval-Augmented Generation
│   ├── __init__.py
│   ├── retriever.py            # High-level retrieval API
│   ├── embeddings.py           # Text embedding service
│   └── vector_store.py         # Vector database abstraction
│
├── schemas/                    # Pydantic data models
│   ├── __init__.py
│   ├── input_schema.py         # Input validation schemas
│   └── output_schema.py        # Output data structures
│
└── utils/                      # Utilities
    ├── __init__.py
    └── logger.py               # Centralized logging
```

## 🏗️ Architecture

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   CareerRecommendationPipeline              │
│                      (Main Entry Point)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              PipelineOrchestrator                           │
│         (Agent Sequencing & State Management)               │
└────────┬──────────┬──────────┬──────────┬──────────────────┘
         │          │          │          │
    Stage 1     Stage 2     Stage 3   Stage 4    Stage 5
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
    │Profile │ │  CV    │ │Career  │ │  Gap   │ │Roadmap │
    │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │
    └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
         │          │          │          │          │
         └──────────┴──────────┴──────────┴──────────┘
                    │
            All agents can use │
                  RAG System   │
                    │          │
                    ▼          ▼
            ┌──────────────────────────┐
            │  Retriever               │
            │  - EmbeddingService      │
            │  - VectorStore           │
            │  - Knowledge Bases       │
            └──────────────────────────┘
```

### Agent Responsibilities

| Agent | Input | Output | Purpose |
|-------|-------|--------|---------|
| **ProfileAgent** | UserProfile | Skill categories, experience analysis | Analyze user profile and extract insights |
| **CVAgent** | CV text | Extracted skills and experience | Parse CV and extract relevant information |
| **CareerAgent** | Profile + CV data | Career recommendations, scores | Match user to suitable careers |
| **GapAgent** | Current skills + Target career | Skill gaps, priorities | Identify and prioritize skill gaps |
| **RoadmapAgent** | Skill gaps + Target career | Learning roadmap, milestones | Create structured learning path |

## 🚀 Quick Start

### Installation

```bash
cd backend
pip install -r requirements.txt  # TODO: Create requirements.txt
```

### Environment Setup

Create a `.env` file in the `backend/` directory:

```env
# LLM Configuration
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4

# Embedding Configuration
EMBEDDING_MODEL=text-embedding-3-small

# Logging
LOG_LEVEL=INFO

# Feature Flags
ENABLE_PROFILE_AGENT=true
ENABLE_CV_AGENT=true
ENABLE_CAREER_AGENT=true
ENABLE_GAP_AGENT=true
ENABLE_ROADMAP_AGENT=true
```

### Run Example

```bash
# From backend directory
python -m ai_v2.main_pipeline
```

Expected output:
```
============================================================
CAREER RECOMMENDATION RESULTS
============================================================
User ID: test_user_001
Recommended Careers: ['Backend Engineer', 'DevOps Engineer']
Confidence Score: 85.00%
Total Roadmap Duration: 3 phases
Recommendation generated successfully!
============================================================
```

## 📖 Usage Examples

### Basic Usage

```python
from ai_v2.main_pipeline import CareerRecommendationPipeline
from ai_v2.schemas import UserProfile

# Create pipeline
pipeline = CareerRecommendationPipeline()

# Create user profile
user = UserProfile(
    user_id="user_123",
    name="John Doe",
    email="john@example.com",
    current_skills=["Python", "JavaScript", "SQL"],
    experience_level="entry",
    education="Bachelor's in Computer Science",
)

# Get recommendations
result = pipeline.recommend(user_profile=user)

# Access results
print(f"Recommended careers: {result.recommended_careers}")
print(f"Confidence: {result.confidence_score:.1%}")
print(f"Number of roadmap phases: {len(result.roadmap)}")
```

### With CV Input

```python
result = pipeline.recommend(
    user_profile=user,
    cv_text=cv_content,
    preferences={"preferred_roles": ["Backend Engineer", "DevOps"]},
)
```

### Dictionary Input (for REST APIs)

```python
result = pipeline.recommend_from_dict({
    "user_profile": {
        "user_id": "user_123",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "current_skills": ["Python", "JavaScript"],
        "experience_level": "mid",
    },
    "cv_text": "...",
    "preferences": {"preferred_roles": ["Backend Engineer"]},
})
```

### Direct Agent Usage

```python
from ai_v2.agents import ProfileAgent, CareerAgent
from ai_v2.schemas import UserProfile

# Create agent
profile_agent = ProfileAgent()

# Run agent directly
result = profile_agent.run({
    "user_profile": user,
})

print(f"Agent success: {result.success}")
print(f"Agent data: {result.data}")
```

## 📚 Module Reference

### Schemas

#### Input Schemas

```python
# UserProfile - User's basic information
UserProfile(
    user_id: str,
    name: str,
    email: str,
    current_skills: List[str] = [],
    experience_level: str = "entry",
    education: Optional[str] = None,
)

# CareerRecommendationInput - Complete pipeline input
CareerRecommendationInput(
    user_profile: UserProfile,
    cv_text: Optional[str] = None,
    job_market_data: Optional[str] = None,
    preferences: Optional[dict] = None,
)
```

#### Output Schemas

```python
# AgentOutput - Standard agent output
AgentOutput(
    agent_type: AgentType,
    success: bool,
    data: Dict[str, Any],
    error: Optional[str] = None,
)

# CareerRecommendationOutput - Final result
CareerRecommendationOutput(
    user_id: str,
    recommended_careers: List[str],
    skill_gaps: List[SkillGapAnalysis],
    roadmap: List[RoadmapStep],
    confidence_score: float,  # 0-1
    agent_outputs: Dict[str, AgentOutput],
)
```

### Configuration

```python
from ai_v2.config import config

# Check current settings
print(config.LLM_MODEL)           # gpt-4
print(config.LOG_LEVEL)           # INFO
print(config.ENABLE_PROFILE_AGENT) # true

# Validate critical settings
config.validate()  # Raises ValueError if missing required env vars
```

### Logging

```python
from ai_v2.utils import get_logger

logger = get_logger(__name__)

logger.info("Processing started")
logger.warning("This is optional")
logger.error("Something went wrong")
```

## 🗺️ Development Roadmap

### Phase 1: Current (Foundation)
- ✅ Clean architecture and folder structure
- ✅ Base agent class and interface
- ✅ Pydantic schemas for validation
- ✅ Mock implementations with TODO markers
- ✅ Logging and configuration system

### Phase 2: LLM Integration
- [ ] OpenAI API integration
- [ ] Model selection logic
- [ ] Prompt engineering framework
- [ ] Token counting and optimization

### Phase 3: RAG System
- [ ] Job market knowledge base
- [ ] Skills database
- [ ] Learning resources library
- [ ] Document chunking strategy
- [ ] Similarity search implementation

### Phase 4: Advanced Features
- [ ] Multi-agent consensus voting
- [ ] Parallel agent execution
- [ ] Caching layer
- [ ] Retry and error recovery
- [ ] Detailed observability

### Phase 5: Integration & Deployment
- [ ] FastAPI application wrapper
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Comprehensive test suite
- [ ] Production monitoring

### Phase 6: Optimization
- [ ] Performance benchmarking
- [ ] Cost optimization
- [ ] Latency optimization
- [ ] Scalability improvements

## 🔌 Integration Guide

### FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from ai_v2.main_pipeline import get_pipeline
from ai_v2.schemas import CareerRecommendationInput

app = FastAPI(title="Career Recommendation API")

@app.post("/recommendations", response_model=dict)
async def get_recommendations(input_data: CareerRecommendationInput):
    """Generate career recommendations."""
    try:
        pipeline = get_pipeline()
        result = pipeline.recommend(
            user_profile=input_data.user_profile,
            cv_text=input_data.cv_text,
            job_market_data=input_data.job_market_data,
            preferences=input_data.preferences,
        )
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### With Existing Backend

1. Create a service wrapper in your backend
2. Call `CareerRecommendationPipeline.recommend()` with user data
3. Store results in your database
4. Return to frontend

```python
# In your backend service
from ai_v2 import CareerRecommendationPipeline
from ai_v2.schemas import UserProfile

def generate_recommendations_for_user(user_id: str) -> dict:
    # Fetch user data from DB
    user_data = fetch_user_from_db(user_id)
    user_profile = UserProfile(**user_data)
    
    # Run pipeline
    pipeline = CareerRecommendationPipeline()
    result = pipeline.recommend(user_profile=user_profile)
    
    # Save to DB
    save_recommendations_to_db(user_id, result)
    
    return result.dict()
```

## 📝 File Responsibilities

| File | Responsibility |
|------|-----------------|
| `config.py` | Environment variables, feature flags, settings |
| `main_pipeline.py` | High-level public API, example usage |
| `orchestrator.py` | Agent sequencing, data flow, error handling |
| `agents/base_agent.py` | Abstract base class, common agent logic |
| `agents/*_agent.py` | Specific agent implementations |
| `rag/retriever.py` | High-level RAG API |
| `rag/embeddings.py` | Text embedding generation |
| `rag/vector_store.py` | Vector database operations |
| `schemas/input_schema.py` | Input validation models |
| `schemas/output_schema.py` | Output data structures |
| `utils/logger.py` | Centralized logging |

## ✅ TODO Markers

Throughout the codebase, `# TODO:` comments mark features for implementation:

```bash
# Find all TODOs
grep -r "TODO:" backend/ai_v2/ | head -20
```

Common TODO areas:
- LLM API integrations
- RAG knowledge base building
- Actual skill extraction algorithms
- Performance optimizations
- Error recovery strategies

## 🤝 Contributing

When adding new features:

1. Keep modules focused and single-responsible
2. Add comprehensive docstrings
3. Update `__all__` exports in `__init__.py` files
4. Add TODO comments for incomplete implementations
5. Use type hints consistently
6. Include examples in docstrings

## 📄 License

[Your License Here]

## 🙋 Support

For questions or issues, refer to the copilot-instructions.md at the project root.
