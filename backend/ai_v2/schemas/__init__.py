"""
Schemas package for AI v2 module.

Exports Pydantic models used for input/output validation across the AI pipeline.
"""

from .input_schema import UserProfile, CareerRecommendationInput
from .output_schema import (
    AgentOutput,
    CareerRecommendationOutput,
    SkillGapAnalysis,
    SkillGapItem,
    RoadmapStep,
    CareerRecommendation,
    AgentType,
)

__all__ = [
    "UserProfile",
    "CareerRecommendationInput",
    "AgentOutput",
    "CareerRecommendationOutput",
    "SkillGapAnalysis",
    "SkillGapItem",
    "RoadmapStep",
    "CareerRecommendation",
    "AgentType",
]
