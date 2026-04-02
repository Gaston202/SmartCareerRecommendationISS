"""
Gap Agent for AI v2 module.

Analyzes skill gaps between current state and target career using LLM + RAG.
"""

from typing import Any, Dict, List

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
            self._log_execution("Starting skill gap analysis with LLM + RAG")

            target_role = input_data.get("target_role")
            current_skills = input_data.get("current_skills", [])
            required_skills = input_data.get("required_skills", [])
            
            # ================================================================
            # Extract data from user_profile and recommended_careers if needed
            # ================================================================
            user_profile = input_data.get("user_profile")
            recommended_careers = input_data.get("recommended_careers", [])
            
            # Extract current_skills from user_profile if not provided
            if user_profile and not current_skills:
                current_skills = user_profile.get("current_skills", []) if isinstance(user_profile, dict) else getattr(user_profile, "current_skills", [])
            
            # Extract target_role and required_skills from primary career if not provided
            if recommended_careers and (not target_role or not required_skills):
                primary_career = recommended_careers[0] if isinstance(recommended_careers, list) else recommended_careers
                if isinstance(primary_career, dict):
                    target_role = target_role or primary_career.get("role", "Backend Engineer")
                    required_skills = required_skills or primary_career.get("required_skills", [])
            
            # If still missing, use defaults
            if not target_role:
                target_role = "Backend Engineer"
            
            # ================================================================
            # Retrieve required skills from RAG if not provided
            # ================================================================
            if not required_skills:
                rag_required = self._get_required_skills_from_rag(target_role)
                if rag_required:
                    required_skills = rag_required
                    self._log_execution(
                        f"Retrieved {len(required_skills)} required skills from RAG for {target_role}"
                    )
            
            # Graceful handling: if skills are empty, treat all required_skills as gaps
            if not required_skills:
                self._log_execution("No required_skills provided, returning empty gap analysis", level="warning")
                return self._create_output(
                    success=True,
                    data={
                        "target_role": target_role,
                        "gap_analysis": [],
                        "skill_gaps": [],
                        "gaps": [],
                        "note": "No required skills defined for gap analysis"
                    },
                )
            
            if not current_skills:
                self._log_execution("No current_skills - treating all required_skills as gaps", level="info")
                # All required skills are gaps when user has no current skills
                # Create SkillGapAnalysis objects for each required skill
                gap_items = [SkillGapItem(skill=s) for s in required_skills[:5]]
                gap_analysis = SkillGapAnalysis(
                    target_role=target_role,
                    current_skills=[],
                    required_skills=required_skills,
                    gap_items=gap_items,
                    gap_percentage=1.0,
                    priority_gaps=required_skills[:3],
                )
                return self._create_output(
                    success=True,
                    data={
                        "target_role": target_role,
                        "current_skills": [],
                        "required_skills": required_skills,
                        "gap_analysis": gap_analysis.model_dump(),
                        "skill_gaps": [gap_analysis.model_dump()],
                        "gaps": [gap_analysis.model_dump()],
                        "priority_gaps": required_skills[:3],
                        "note": "No current skills - all required skills are gaps"
                    },
                )
            
            # Use LLM to analyze gaps
            rag_context = self._get_rag_context(target_role, required_skills)
            llm_result = self.llm.analyze_skill_gaps(
                current_skills=current_skills,
                target_role=target_role,
                required_skills=required_skills,
                rag_context=rag_context,
            )
            
            if not llm_result.get("success"):
                # FIX #6: Return graceful empty response instead of raising
                self._log_execution(
                    "LLM gap analysis failed, returning empty gap analysis",
                    level="warning"
                )
                # Create empty SkillGapAnalysis for consistency
                gap_analysis = SkillGapAnalysis(
                    target_role=target_role,
                    current_skills=current_skills,
                    required_skills=required_skills,
                    gap_items=[],
                    gap_percentage=self._calculate_coverage(current_skills, required_skills),
                    priority_gaps=[],
                )
                return self._create_output(
                    success=True,
                    data={
                        "target_role": target_role,
                        "current_skills": current_skills,
                        "required_skills": required_skills,
                        "gap_items": [],
                        "skill_gaps": [gap_analysis.model_dump()],
                        "gaps": [gap_analysis.model_dump()],
                        "gap_percentage": self._calculate_coverage(current_skills, required_skills),
                        "priority_gaps": [],
                        "note": "Gap analysis unavailable, but structure is valid for roadmap generation"
                    },
                )
            
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
                "gaps": [gap_analysis.model_dump()],
                "skill_gaps": [gap_analysis.model_dump()],  # Include both keys for compatibility
                "priority_gaps": llm_result.get("priority_gaps", []),
                "timeline_months": llm_result.get("timeline_months", 6),
                "recommendations": llm_result.get("recommendations", []),
                "gap_percentage": gap_analysis.gap_percentage,
                "llm_source": llm_result.get("source", "unknown"),  # Track pipeline source
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
    
    def _get_required_skills_from_rag(self, target_role: str) -> List[str]:
        """
        Retrieve required skills for a target role from RAG knowledge base.
        
        Args:
            target_role: Target career role
            
        Returns:
            List of required skills
        """
        try:
            try:
                from ..tools.base import retrieve_documents
            except ImportError:
                return []
            
            # Query for target role information
            query = f"{target_role} required skills requirements"
            rag_result = retrieve_documents(query, top_k=1)
            
            if not rag_result.get("success") or not rag_result.get("documents"):
                return []
            
            # Extract skills from metadata - check multiple possible fields
            for doc in rag_result.get("documents", []):
                if doc["category"] == "career":
                    metadata = doc.get("metadata", {})
                    # Try enhanced metadata fields first (new structure)
                    skills = metadata.get("required_skills") or metadata.get("core_skills") or metadata.get("skills", [])
                    if skills:
                        return skills if isinstance(skills, list) else []
            
            return []
            
        except Exception as e:
            self._log_execution(f"Error retrieving required skills from RAG: {e}", level="debug")
            return []
    
    def _get_rag_context(self, target_role: str, required_skills: List[str]) -> str:
        """
        Retrieve RAG context with skill prerequisites and difficulty levels.
        
        Args:
            target_role: Target career role
            required_skills: Skills needed for the role
            
        Returns:
            Formatted RAG context with prerequisites and difficulty info
        """
        try:
            from ..tools.base import retrieve_documents
        except ImportError:
            return ""
        
        try:
            # Query for skill prerequisite and difficulty information
            query = f"{target_role} skills prerequisites learning difficulty requirements"
            rag_result = retrieve_documents(query, top_k=10)
            
            if not rag_result.get("success") or not rag_result.get("documents"):
                return ""
            
            # Build context from documents with emphasis on metadata
            context_lines = []
            for doc in rag_result.get("documents", []):
                title = doc.get("title", "Unknown")
                category = doc.get("category", "general")
                content = doc.get("content", "")[:200]  # Truncate to 200 chars
                
                metadata = doc.get("metadata", {})
                skills = metadata.get("skills", [])
                difficulty = metadata.get("difficulty", "unknown")
                prerequisites = metadata.get("prerequisites", [])
                
                # Format context with emphasis on metadata
                context_lines.append(f"- {title} ({category}, difficulty: {difficulty})")
                if prerequisites:
                    context_lines.append(f"  Prerequisites: {', '.join(prerequisites)}")
                if skills:
                    context_lines.append(f"  Skills: {', '.join(skills[:5])}")
                context_lines.append(f"  Content: {content}...")
            
            context = "\n".join(context_lines)
            return context if context else ""
            
        except Exception as e:
            self._log_execution(f"Error retrieving RAG context: {e}", level="debug")
            return ""

