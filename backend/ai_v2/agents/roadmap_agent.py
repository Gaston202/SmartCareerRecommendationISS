"""
Roadmap Agent for AI v2 module.

Generates personalized career roadmaps.
"""

from typing import Any, Dict

from ..schemas import AgentOutput, AgentType, RoadmapStep
from ..services import LLMService
from .base_agent import BaseAgent


class RoadmapAgent(BaseAgent):
    """
    Agent responsible for generating career roadmaps.
    
    Purpose:
        - Create phased learning roadmap
        - Structure progression from current state to target role
        - Assign skills to each phase
        - Estimate duration per phase
        - Recommend resources and milestones for each phase
    
    TODO:
        - Implement roadmap generation algorithm
        - Query RAG for learning resources per skill
        - Add practical project milestones
        - Create timeline estimates
        - Include optional side-quests (nice-to-have learning paths)
        - Generate Gantt chart or timeline visualization
    """

    def __init__(self):
        """Initialize the RoadmapAgent."""
        super().__init__(
            agent_type=AgentType.ROADMAP,
            name="Roadmap Generator",
        )
        self.llm = LLMService()

    def run(self, input_data: Dict[str, Any]) -> AgentOutput:
        """
        Generate career roadmap using LLM.
        
        Args:
            input_data (Dict[str, Any]): Must contain:
                - target_role: Target job role
                - missing_skills: Skills to learn
                - experience_level: Current experience level
        
        Returns:
            AgentOutput: Career roadmap with phased learning steps
        
        Example:
            >>> agent = RoadmapAgent()
            >>> result = agent.run({
            ...     "target_role": "Backend Engineer",
            ...     "missing_skills": ["Docker", "System Design"],
            ...     "experience_level": "intermediate"
            ... })
        """
        try:
            self._log_execution("Starting roadmap generation with LLM")

            target_role = input_data.get("target_role", "Backend Engineer")
            missing_skills = input_data.get("missing_skills", [])
            experience_level = input_data.get("experience_level", "intermediate")
            
            if not missing_skills:
                raise ValueError("missing_skills is required for roadmap generation")
            
            # Use LLM to generate roadmap
            llm_result = self.llm.generate_learning_roadmap(
                target_role=target_role,
                missing_skills=missing_skills,
                current_experience=experience_level,
            )
            
            if not llm_result.get("success"):
                raise ValueError("LLM failed to generate roadmap")
            
            # Extract phases and create RoadmapStep objects
            roadmap_steps = []
            phases = llm_result.get("phases", [])
            
            for idx, phase in enumerate(phases[:5], 1):  # Limit to 5 phases
                step = RoadmapStep(
                    phase=idx,
                    title=phase.get("title", f"Phase {idx}"),
                    duration_months=phase.get("duration_months", 1),
                    skills_to_learn=phase.get("skills", []),
                    resources=phase.get("resources", []),
                    milestones=phase.get("milestones", []),
                )
                roadmap_steps.append(step)
            
            # Calculate total duration
            total_months = sum(step.duration_months for step in roadmap_steps)
            
            roadmap_data = {
                "target_role": target_role,
                "total_roadmap_months": total_months,
                "phases": [step.dict() for step in roadmap_steps],
                "success_criteria": llm_result.get("success_criteria", []),
                "milestones": llm_result.get("milestones", []),
                "resources": llm_result.get("resources", []),
            }
            
            self._log_execution(
                f"Roadmap generation completed - {len(roadmap_steps)} phases created"
            )

            return self._create_output(
                success=True,
                data=roadmap_data,
            )

        except Exception as e:
            self._log_execution(f"Error during roadmap generation: {str(e)}", level="error")
            return self._create_output(
                success=False,
                error=str(e),
            )
