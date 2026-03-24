"""
Gap Agent for AI v2 module.

Analyzes skill gaps between current state and target career using LLM.
"""

from typing import Any, Dict

from ..schemas import AgentOutput, AgentType, SkillGapAnalysis, SkillGapItem
from ..services import LLMService
from .base_agent import BaseAgent


class GapAgent(BaseAgent):
    """
    Agent responsible for skill gap analysis.
    
    Purpose:
        - Use LLM to compare current skills with target career requirements
        - Identify missing skills and proficiency gaps
        - Score the difficulty and priority of each gap
        - Estimate time to close gaps
        - Provide learning recommendations per gap
    
    LLM Integration:
        - Uses OpenAI GPT-4 for gap analysis (with mock fallback)
        - Generates prioritized gap lists
        - Estimates learning timelines
    
    TODO:
        - Add proficiency level mapping
        - Query RAG for learning resources
        - Create prioritized gap list (easy -> hard, impactful -> nice-to-have)
    """

    def __init__(self):
        """Initialize the GapAgent."""
        super().__init__(
            agent_type=AgentType.GAP,
            name="Skill Gap Analyzer",
        )
        self.llm = LLMService()

    def run(self, input_data: Dict[str, Any]) -> AgentOutput:
        """
        Analyze skill gaps for target career using LLM.
        
        Args:
            input_data (Dict[str, Any]): Must contain:
                - target_role: Target job role
                - current_skills: User's current skills
                - required_skills: Skills needed for target role
        
        Returns:
            AgentOutput: Skill gap analysis with priorities
        
        Example:
            >>> agent = GapAgent()
            >>> result = agent.run({
            ...     "target_role": "Backend Engineer",
            ...     "current_skills": ["Python", "SQL"],
            ...     "required_skills": ["Python", "SQL", "Docker", "System Design"]
            ... })
        """
        try:
            self._log_execution("Starting skill gap analysis with LLM")

            target_role = input_data.get("target_role", "Backend Engineer")
            current_skills = input_data.get("current_skills", [])
            required_skills = input_data.get("required_skills", [])
            
            if not current_skills or not required_skills:
                raise ValueError("current_skills and required_skills are required")
            
            # Use LLM to analyze gaps
            llm_result = self.llm.analyze_skill_gaps(
                current_skills=current_skills,
                target_role=target_role,
                required_skills=required_skills,
            )
            
            if not llm_result.get("success"):
                raise ValueError("LLM failed to analyze skill gaps")
            
            # Extract gap items from LLM result
            gap_items = []
            gap_analysis_raw = llm_result.get("gap_analysis", [])
            for gap in gap_analysis_raw[:5]:  # Limit to 5 gaps
                gap_items.append(
                    SkillGapItem(
                        skill=gap,
                        priority="high" if gap in llm_result.get("priority_gaps", []) else "medium",
                    )
                )
            
            # Create structured gap analysis
            gap_analysis = SkillGapAnalysis(
                target_role=target_role,
                current_skills=current_skills,
                required_skills=required_skills,
                gap_items=gap_items,
                gap_percentage=self._calculate_coverage(current_skills, required_skills),
                priority_gaps=llm_result.get("priority_gaps", []),
            )
            
            skill_gaps_data = {
                "gaps": [gap_analysis.dict()],
                "priority_gaps": llm_result.get("priority_gaps", []),
                "timeline_months": llm_result.get("timeline_months", 6),
                "recommendations": llm_result.get("recommendations", []),
                "gap_percentage": gap_analysis.gap_percentage,
            }
            
            self._log_execution(
                f"Skill gap analysis completed - {len(gap_items)} gaps identified"
            )
            
            return self._create_output(
                success=True,
                data=skill_gaps_data,
            )

        except Exception as e:
            self._log_execution(f"Error during gap analysis: {str(e)}", level="error")
            return self._create_output(
                success=False,
                error=str(e),
            )
    
    def _calculate_coverage(self, current: list, required: list) -> float:
        """Calculate skill coverage percentage."""
        if not required:
            return 1.0
        matched = len([s for s in required if s.lower() in [c.lower() for c in current]])
        return matched / len(required)
