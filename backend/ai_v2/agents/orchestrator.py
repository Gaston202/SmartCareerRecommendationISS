"""
Pipeline Orchestrator - Manages agent sequencing and data flow

Coordinates the execution of multiple agents in the correct order:
1. ProfileAgent - Analyzes user profile and CV
2. CareerAgent - Generates career recommendations
3. GapAgent - Analyzes skill gaps
4. RoadmapAgent - Creates learning roadmaps

The orchestrator handles:
- Agent initialization and lifecycle
- Data transformation between agents
- Error handling and graceful fallbacks
- Logging and observability
"""

from typing import Optional, Dict, Any
from datetime import datetime

from ..schemas import (
    UserProfile,
    CareerRecommendationOutput,
    CareerRecommendation,
    AgentOutput,
    AgentType,
    SkillGapAnalysis,
    SkillGapItem,
)
from . import (
    CareerAgent,
    GapAgent,
    RoadmapAgent,
    ProfileAgent,
)
from ..utils import get_logger

logger = get_logger(__name__)


class PipelineOrchestrator:
    """
    Orchestrates the execution of career recommendation agents.
    
    Manages:
    - Agent initialization and sequencing
    - Data flow between agents
    - Error handling and fallbacks
    - State and output aggregation
    
    Usage:
        orchestrator = PipelineOrchestrator()
        output = orchestrator.run_pipeline({
            "user_profile": user,
            "cv_text": cv_text,
        })
    """
    
    def __init__(self):
        """Initialize the orchestrator and its agents."""
        self.career_agent = CareerAgent()
        self.gap_agent = GapAgent()
        self.roadmap_agent = RoadmapAgent()
        self.profile_agent = ProfileAgent()
        logger.info("✅ PipelineOrchestrator initialized with all agents")
    
    def run_pipeline(
        self,
        pipeline_input: Dict[str, Any],
    ) -> CareerRecommendationOutput:
        """
        Execute the full career recommendation pipeline.
        
        Args:
            pipeline_input: Dictionary containing:
                - user_profile: UserProfile object
                - cv_text: Optional CV text
                - job_market_data: Optional market context
                - preferences: Optional user preferences
        
        Returns:
            CareerRecommendationOutput with complete analysis
        """
        user_profile = pipeline_input.get("user_profile")
        cv_text = pipeline_input.get("cv_text")
        job_market_data = pipeline_input.get("job_market_data")
        preferences = pipeline_input.get("preferences")
        
        if not user_profile:
            raise ValueError("pipeline_input must contain 'user_profile'")
        
        logger.info(f"🚀 Starting pipeline for user: {user_profile.user_id}")
        
        agent_outputs = {}
        
        try:
            # Step 1: Profile Analysis
            logger.debug("Step 1: Analyzing user profile...")
            profile_output = self._run_profile_step(user_profile, cv_text)
            agent_outputs["profile"] = profile_output
            logger.debug(f"✓ Profile analysis complete")
            
            # Step 2: Career Recommendations
            logger.debug("Step 2: Generating career recommendations...")
            career_output = self._run_career_step(
                user_profile, profile_output, preferences, job_market_data
            )
            agent_outputs["career"] = career_output
            raw_careers = career_output.data.get("recommended_careers", [])
            logger.debug(f"✓ Generated {len(raw_careers)} career recommendations")
            
            # Step 3: Skill Gap Analysis
            gap_output = self._run_gap_step(user_profile, raw_careers)
            agent_outputs["gap"] = gap_output
            
            # Step 4: Roadmap Generation
            roadmap_output = self._run_roadmap_step(
                user_profile, career_output, gap_output
            )
            agent_outputs["roadmap"] = roadmap_output
            
            # Build final output
            recommended_careers = self._build_career_recommendations(raw_careers)
            
            # Wrap raw skill strings into SkillGapAnalysis objects
            # Gap agent returns data in "gaps" key as list of dicts or "priority_gaps" as strings
            raw_gaps = gap_output.data.get("gaps", [])
            if not raw_gaps:
                # Fallback: check for priority_gaps if gaps not found
                priority_gaps = gap_output.data.get("priority_gaps", [])
                raw_gaps = priority_gaps if priority_gaps else []
            
            skill_gaps = []
            for gap in raw_gaps:
                if isinstance(gap, str):
                    # Raw string skill name
                    skill_gaps.append(SkillGapAnalysis(
                        target_role=career_output.data.get("primary_recommendation", {}).get("role", "Unknown"),
                        gap_items=[SkillGapItem(skill=gap)],
                    ))
                elif isinstance(gap, dict):
                    # Dict representation of SkillGapAnalysis
                    skill_gaps.append(SkillGapAnalysis(**gap))
                elif isinstance(gap, SkillGapAnalysis):
                    # Already typed object
                    skill_gaps.append(gap)
            
            result = CareerRecommendationOutput(
                user_id=user_profile.user_id,
                recommended_careers=recommended_careers,
                skill_gaps=skill_gaps,
                roadmap=roadmap_output.data.get("phases", []),
                confidence_score=float(career_output.data.get("confidence", 0.75)),
                agent_outputs=agent_outputs,
            )
            
            logger.info(f"✅ Pipeline complete for user {user_profile.user_id}")
            logger.info(f"   - Recommended {len(recommended_careers)} careers")
            logger.info(f"   - Confidence: {result.confidence_score:.1%}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Pipeline error: {str(e)}", exc_info=True)
            # Return error response with status flags and detailed error information
            error_type = type(e).__name__
            error_msg = str(e)
            
            return CareerRecommendationOutput(
                user_id=user_profile.user_id,
                recommended_careers=[],
                skill_gaps=[],
                roadmap=[],
                confidence_score=0.0,
                success=False,
                error=f"Pipeline failed: {error_msg}",
                error_type=error_type,
                agent_outputs=agent_outputs,
            )
    
    def _run_profile_step(
        self,
        user_profile: UserProfile,
        cv_text: Optional[str],
    ) -> AgentOutput:
        """Run profile analysis step."""
        profile_input = {
            "user_profile": user_profile,
            "cv_text": cv_text,
        }
        return self.profile_agent.run(profile_input)
    
    def _run_career_step(
        self,
        user_profile: UserProfile,
        profile_output: AgentOutput,
        preferences: Optional[Dict[str, Any]],
        job_market_data: Optional[str],
    ) -> AgentOutput:
        """Run career recommendations step."""
        career_input = {
            "user_profile": user_profile,
            "cv_data": profile_output.data if profile_output.success else None,
            "preferences": preferences,
            "job_market_data": job_market_data,
        }
        return self.career_agent.run(career_input)
    
    def _run_gap_step(
        self,
        user_profile: UserProfile,
        raw_careers: list,
    ) -> AgentOutput:
        """Run skill gap analysis step with graceful fallback."""
        if raw_careers and any("role" in c for c in raw_careers):
            logger.debug("Step 3: Analyzing skill gaps...")
            gap_input = {
                "user_profile": user_profile,
                "recommended_careers": raw_careers,
            }
            gap_output = self.gap_agent.run(gap_input)
            logger.debug(f"✓ Skill gap analysis complete")
            return gap_output
        else:
            logger.warning("Skipping gap analysis: no valid career recommendations")
            # Create minimal output for gap_output
            return AgentOutput(
                success=False,
                agent_type=AgentType.GAP,
                data={"skill_gaps": [], "gap_items": []},
                message="No careers available for gap analysis"
            )
    
    def _run_roadmap_step(
        self,
        user_profile: UserProfile,
        career_output: AgentOutput,
        gap_output: AgentOutput,
    ) -> AgentOutput:
        """Run learning roadmap generation with fallback skills."""
        # Extract relevant data from previous steps
        primary_rec = career_output.data.get("primary_recommendation")
        target_career_role = primary_rec.get("role") if primary_rec else None
        
        # Extract skills from gap_output - gap_items are nested inside "gaps" array
        skill_gaps = []
        if gap_output and gap_output.data:
            # Try top-level gap_items first (direct access)
            skill_gaps = gap_output.data.get("gap_items", [])
            
            # If not found, try nested structure: gaps[0].gap_items
            if not skill_gaps:
                gaps_list = gap_output.data.get("gaps", [])
                if gaps_list and isinstance(gaps_list[0], dict):
                    skill_gaps = gaps_list[0].get("gap_items", [])
            
            # If still not found, try skill_gaps key
            if not skill_gaps:
                skill_gaps_list = gap_output.data.get("skill_gaps", [])
                if skill_gaps_list and isinstance(skill_gaps_list[0], dict):
                    skill_gaps = skill_gaps_list[0].get("gap_items", [])
        
        required_skills_from_career = primary_rec.get("required_skills", []) if primary_rec else []
        
        # Convert gap_items (which are dicts with "skill" field) to just skill names
        # gap_items format: [{"skill": "Python", "priority": "high"}, ...]
        # We need: ["Python", "Docker", ...]
        skill_names = []
        for item in skill_gaps:
            if isinstance(item, dict) and "skill" in item:
                skill_names.append(item["skill"])
            elif isinstance(item, str):
                skill_names.append(item)
        skill_gaps = skill_names
        
        # Use skill_gaps if available, OR use required_skills as fallback
        # This ensures roadmap runs even when gap_agent returns empty gaps (because LLM unavailable)
        skills_for_roadmap = skill_gaps if skill_gaps else required_skills_from_career
        
        if target_career_role and skills_for_roadmap:
            logger.debug(
                f"Step 4: Generating learning roadmap "
                f"(skills_for_roadmap={len(skills_for_roadmap)} items)..."
            )
            roadmap_input = {
                "user_profile": user_profile,
                "target_career": target_career_role,
                "missing_skills": skills_for_roadmap,
            }
            roadmap_output = self.roadmap_agent.run(roadmap_input)
            logger.debug(f"✓ Generated learning roadmap with {len(skills_for_roadmap)} skill targets")
            return roadmap_output
        else:
            logger.warning(
                f"Skipping roadmap: target_career={target_career_role}, "
                f"skills_for_roadmap={len(skills_for_roadmap) if skills_for_roadmap else 0}"
            )
            # Create minimal output for roadmap_output
            return AgentOutput(
                success=False,
                agent_type=AgentType.ROADMAP,
                data={"roadmap_steps": []},
                message="Insufficient data for roadmap generation"
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
