"""
Main Career Recommendation Pipeline - AI v2 Module

This is the high-level entry point for the career recommendation system.
It provides a clean public API that delegates to PipelineOrchestrator.

Architecture:
    - PipelineOrchestrator: Coordinates agent sequencing and data flow
    - Multiple agents: ProfileAgent, CareerAgent, GapAgent, RoadmapAgent
    - Schemas: Input/output validation
    - Utils: Logging, helpers

Usage:
    pipeline = CareerRecommendationPipeline()
    result = pipeline.recommend(user_profile=user)
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

from .schemas import (
    UserProfile,
    CareerRecommendationOutput,
    CareerRecommendation,
    AgentOutput,
    AgentType,
)
from .agents.orchestrator import PipelineOrchestrator
from .utils import get_logger

logger = get_logger(__name__)


class CareerRecommendationPipeline:
    """
    High-level API for career recommendations.
    
    Provides a clean public interface that delegates to PipelineOrchestrator
    for the actual agent coordination and data flow management.
    
    Responsibilities:
    - Accept user inputs
    - Validate inputs
    - Delegate to orchestrator
    - Return structured results
    """
    
    def __init__(self):
        """Initialize the pipeline with an orchestrator."""
        self.orchestrator = PipelineOrchestrator()
        logger.info("✅ CareerRecommendationPipeline initialized")
    
    def recommend(
        self,
        user_profile: UserProfile,
        cv_text: Optional[str] = None,
        job_market_data: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None,
    ) -> CareerRecommendationOutput:
        """
        Generate comprehensive career recommendations for a user.
        
        Args:
            user_profile: User profile with skills, experience, etc.
            cv_text: Optional CV text for analysis
            job_market_data: Optional market context
            preferences: Optional user preferences
        
        Returns:
            CareerRecommendationOutput with careers, gaps, and roadmap
        """
        pipeline_input = {
            "user_profile": user_profile,
            "cv_text": cv_text,
            "job_market_data": job_market_data,
            "preferences": preferences,
        }
        return self.orchestrator.run_pipeline(pipeline_input)


def get_pipeline() -> CareerRecommendationPipeline:
    """Factory function to get initialized pipeline."""
    return CareerRecommendationPipeline()
