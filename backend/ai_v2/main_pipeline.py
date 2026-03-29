"""
Main Career Recommendation Pipeline - AI v2 Module

This is the primary entry point for the career recommendation system.
It orchestrates agents to provide comprehensive career recommendations.

Architecture:
    - CareerAgent: Generates career recommendations
    - GapAgent: Analyzes skill gaps
    - RoadmapAgent: Creates learning roadmaps
    - ProfileAgent: Analyzes user profile

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
from .agents import (
    CareerAgent,
    GapAgent,
    RoadmapAgent,
    ProfileAgent,
)
from .utils import get_logger

logger = get_logger(__name__)


class CareerRecommendationPipeline:
    """
    Main pipeline for career recommendations.
    
    Orchestrates multiple agents to provide:
    - Career recommendations with match scores
    - Skill gap analysis
    - Learning roadmaps
    - User profile insights
    """
    
    def __init__(self):
        """Initialize the pipeline and its agents."""
        self.career_agent = CareerAgent()
        self.gap_agent = GapAgent()
        self.roadmap_agent = RoadmapAgent()
        self.profile_agent = ProfileAgent()
        logger.info("✅ CareerRecommendationPipeline initialized with all agents")
    
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
        logger.info(f"🚀 Starting recommendation pipeline for user: {user_profile.user_id}")
        
        agent_outputs = {}
        
        try:
            # Step 1: Profile Analysis
            logger.debug("Step 1: Analyzing user profile...")
            profile_input = {
                "user_profile": user_profile,
                "cv_text": cv_text,
            }
            profile_output = self.profile_agent.run(profile_input)
            agent_outputs["profile"] = profile_output
            logger.debug(f"✓ Profile analysis complete")
            
            # Step 2: Career Recommendations
            logger.debug("Step 2: Generating career recommendations...")
            career_input = {
                "user_profile": user_profile,
                "cv_data": profile_output.data if profile_output.success else None,
                "preferences": preferences,
                "job_market_data": job_market_data,
            }
            career_output = self.career_agent.run(career_input)
            agent_outputs["career"] = career_output
            
            # DEBUG: Print raw career output
            logger.info(f"DEBUG: career_output.data keys = {career_output.data.keys()}")
            logger.info(f"DEBUG: recommended_careers = {career_output.data.get('recommended_careers', [])}")
            
            raw_careers = career_output.data.get("recommended_careers", [])
            logger.debug(f"✓ Generated {len(raw_careers)} career recommendations")
            
            # Step 3: Skill Gap Analysis (only if we have careers and required fields)
            gap_output = None
            if raw_careers and any("role" in c for c in raw_careers):
                logger.debug("Step 3: Analyzing skill gaps...")
                gap_input = {
                    "user_profile": user_profile,
                    "recommended_careers": raw_careers,
                }
                gap_output = self.gap_agent.run(gap_input)
                agent_outputs["gap"] = gap_output
                logger.debug(f"✓ Skill gap analysis complete")
            else:
                logger.warning("Skipping gap analysis: no valid career recommendations")
                # Create minimal output for gap_output
                from .schemas import AgentOutput
                gap_output = AgentOutput(
                    success=False,
                    agent_type=AgentType.GAP,
                    data={"skill_gaps": [], "gap_items": []},
                    message="No careers available for gap analysis"
                )
            
            # Step 4: Roadmap Generation
            # FIX #7: Run roadmap even when gaps=0 if required_skills exist
            primary_rec = career_output.data.get("primary_recommendation")
            target_career_role = primary_rec.get("role") if primary_rec else None
            skill_gaps = gap_output.data.get("gap_items", []) if gap_output else []
            
            # Extract required_skills from primary recommendation if available
            required_skills_from_career = primary_rec.get("required_skills", []) if primary_rec else []
            
            roadmap_output = None
            # CONDITION FIX: Use skill_gaps if available, OR use required_skills as fallback
            # This ensures roadmap runs even when gap_agent returns empty gaps (because LLM unavailable)
            skills_for_roadmap = skill_gaps if skill_gaps else required_skills_from_career
            
            if target_career_role and skills_for_roadmap:
                logger.debug(f"Step 4: Generating learning roadmap (skills_for_roadmap={len(skills_for_roadmap)} items)...")
                roadmap_input = {
                    "user_profile": user_profile,
                    "target_career": target_career_role,
                    "missing_skills": skills_for_roadmap,  # Use gap_items if available, else use required_skills
                }
                roadmap_output = self.roadmap_agent.run(roadmap_input)
                agent_outputs["roadmap"] = roadmap_output
                logger.debug(f"✓ Generated learning roadmap with {len(skills_for_roadmap)} skill targets")
            else:
                logger.warning(f"Skipping roadmap: target_career={target_career_role}, skills_for_roadmap={len(skills_for_roadmap) if skills_for_roadmap else 0}")
                # Create minimal output for roadmap_output
                from .schemas import AgentOutput
                roadmap_output = AgentOutput(
                    success=False,
                    agent_type=AgentType.ROADMAP,
                    data={"roadmap_steps": []},
                    message="Insufficient data for roadmap generation"
                )
            
            # Build final output
            recommended_careers = self._build_career_recommendations(
                raw_careers
            )
            
            result = CareerRecommendationOutput(
                user_id=user_profile.user_id,
                recommended_careers=recommended_careers,
                skill_gaps=gap_output.data.get("skill_gaps", []),
                roadmap=roadmap_output.data.get("roadmap_steps", []),
                confidence_score=float(career_output.data.get("confidence", 0.75)),
                agent_outputs=agent_outputs,
            )
            
            logger.info(f"✅ Pipeline complete for user {user_profile.user_id}")
            logger.info(f"   - Recommended {len(recommended_careers)} careers")
            logger.info(f"   - Confidence: {result.confidence_score:.1%}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Pipeline error: {str(e)}", exc_info=True)
            # Return minimal valid response with error
            return CareerRecommendationOutput(
                user_id=user_profile.user_id,
                recommended_careers=[],
                skill_gaps=[],
                roadmap=[],
                confidence_score=0.0,
                agent_outputs=agent_outputs,
            )
    
    def _build_career_recommendations(
        self, career_data: list
    ) -> list[CareerRecommendation]:
        """Transform agent career data into structured recommendations."""
        recommendations = []
        
        for item in career_data:
            if isinstance(item, CareerRecommendation):
                recommendations.append(item)
            elif isinstance(item, dict):
                try:
                    rec = CareerRecommendation(**item)
                    recommendations.append(rec)
                except Exception as e:
                    logger.warning(f"Could not parse career item: {e}")
                    # Try minimal parsing
                    if "role" in item:
                        rec = CareerRecommendation(role=item["role"])
                        recommendations.append(rec)
        
        return recommendations


def get_pipeline() -> CareerRecommendationPipeline:
    """Factory function to get initialized pipeline."""
    return CareerRecommendationPipeline()
