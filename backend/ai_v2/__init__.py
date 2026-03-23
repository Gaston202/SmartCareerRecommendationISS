"""
AI v2 Module for Smart Career Recommendation System.

A clean, scalable, production-ready AI module for generating career recommendations
using a multi-agent architecture with RAG capabilities.

Main Entry Points:
    - CareerRecommendationPipeline: High-level API for recommendations
    - PipelineOrchestrator: Internal orchestration of agents
    - Individual agents: ProfileAgent, CVAgent, CareerAgent, GapAgent, RoadmapAgent

Schemas:
    - Input: UserProfile, CareerRecommendationInput
    - Output: CareerRecommendationOutput, AgentOutput, SkillGapAnalysis, RoadmapStep

Usage Example:
    >>> from ai_v2.main_pipeline import CareerRecommendationPipeline
    >>> from ai_v2.schemas import UserProfile
    >>> 
    >>> pipeline = CareerRecommendationPipeline()
    >>> user = UserProfile(
    ...     user_id="user_123",
    ...     name="John Doe",
    ...     email="john@example.com",
    ...     current_skills=["Python", "JavaScript"],
    ...     experience_level="entry",
    ... )
    >>> result = pipeline.recommend(user_profile=user)
    >>> print(result.recommended_careers)

FastAPI Integration Example:
    >>> from fastapi import FastAPI
    >>> from ai_v2.main_pipeline import get_pipeline
    >>> 
    >>> app = FastAPI()
    >>> 
    >>> @app.post("/recommendations")
    >>> async def get_recommendations(data: dict):
    ...     pipeline = get_pipeline()
    ...     return pipeline.recommend_from_dict(data)

Architecture:
    - Agents: Modular components for specific tasks
    - Orchestrator: Manages agent sequencing and data flow
    - RAG: Retrieval-augmented generation for knowledge access
    - Schemas: Pydantic models for input/output validation
    - Utils: Logging and helper functions

Configuration:
    - Environment variables in config.py
    - Feature flags for enabling/disabling agents
    - Support for multiple LLM and vector store backends

TODO (Next Steps):
    1. Implement actual LLM integrations (OpenAI, Anthropic, etc.)
    2. Build RAG knowledge bases (job market data, skills database)
    3. Add async/parallel agent execution
    4. Implement multi-agent consensus voting
    5. Add observability and monitoring
    6. Create FastAPI application wrapper
    7. Add comprehensive error handling and retry logic
    8. Build extensive test suite
    9. Create Docker deployment configuration
    10. Document and publish module
"""

from .main_pipeline import CareerRecommendationPipeline, get_pipeline
from .orchestrator import PipelineOrchestrator
from .schemas import (
    UserProfile,
    CareerRecommendationInput,
    CareerRecommendationOutput,
    AgentOutput,
    SkillGapAnalysis,
    RoadmapStep,
    AgentType,
)
from .agents import (
    BaseAgent,
    ProfileAgent,
    CVAgent,
    CareerAgent,
    GapAgent,
    RoadmapAgent,
)
from .rag import Retriever, EmbeddingService, VectorStore
from .utils import get_logger
from .config import config, AIConfig

__version__ = "0.1.0"
__author__ = "Smart Career Recommendation Team"

__all__ = [
    # Main API
    "CareerRecommendationPipeline",
    "get_pipeline",
    "PipelineOrchestrator",
    # Schemas
    "UserProfile",
    "CareerRecommendationInput",
    "CareerRecommendationOutput",
    "AgentOutput",
    "SkillGapAnalysis",
    "RoadmapStep",
    "AgentType",
    # Agents
    "BaseAgent",
    "ProfileAgent",
    "CVAgent",
    "CareerAgent",
    "GapAgent",
    "RoadmapAgent",
    # RAG
    "Retriever",
    "EmbeddingService",
    "VectorStore",
    # Utils
    "get_logger",
    "config",
    "AIConfig",
]
