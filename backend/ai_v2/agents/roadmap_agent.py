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
        Generate career roadmap using LLM + RAG context.
        
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
            self._log_execution("Starting roadmap generation with LLM + RAG")

            target_role = input_data.get("target_role", "Backend Engineer")
            missing_skills = input_data.get("missing_skills", [])
            experience_level = input_data.get("experience_level", "intermediate")
            
            # FIX #8: Handle empty missing_skills gracefully - generate generic roadmap for role
            if not missing_skills:
                self._log_execution(
                    f"No missing skills provided for roadmap, generating generic phases for {target_role}",
                    level="warning"
                )
                # Generate generic roadmap phases based on target role only
                generic_phases = self._generate_generic_roadmap(target_role, experience_level)
                return self._create_output(
                    success=True,
                    data={
                        "phases": generic_phases,
                        "target_role": target_role,
                        "experience_level": experience_level,
                        "note": "Generic roadmap (no specific skills provided)",
                        "llm_source": "fallback_generic"
                    },
                )
            
            # ================================================================
            # NEW: Retrieve learning resources from RAG knowledge base
            # ================================================================
            rag_context = self._get_rag_context_for_roadmap(target_role, missing_skills)
            self._log_execution(
                f"Retrieved RAG context with learning resources and project examples"
            )
            
            # Use LLM to generate roadmap with RAG context
            llm_result = self.llm.generate_learning_roadmap(
                target_role=target_role,
                missing_skills=missing_skills,
                current_experience=experience_level,
                rag_context=rag_context.get("context_text", ""),  # NEW: Pass RAG knowledge
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
                "llm_source": llm_result.get("source", "unknown"),  # Track pipeline source
                # NEW: Add RAG-enriched learning resources
                "learning_resources": rag_context.get("resources", []),
                "project_examples": rag_context.get("project_examples", []),
                "rag_enriched": True,
            }
            
            self._log_execution(
                f"Roadmap generation completed - {len(roadmap_steps)} phases created (RAG-enriched)"
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
    
    def _get_rag_context_for_roadmap(
        self, target_role: str, missing_skills: list
    ) -> Dict[str, Any]:
        """
        Retrieve learning resources and project examples from RAG.
        
        Args:
            target_role: Target career role
            missing_skills: Skills that need to be learned
            
        Returns:
            Dict with learning resources and project examples
        """
        try:
            try:
                from ..tools.base import retrieve_documents
            except ImportError:
                self._log_execution("RAG tools module not available, using fallback", level="warning")
                return {"resources": [], "project_examples": [], "context_text": ""}
            
            # Build rich query for learning resources
            query_parts = [
                target_role,
                "learning path project tutorial resources courses",
            ]
            if missing_skills:
                # Add first 3 skills to query
                skills_sample = missing_skills[:3]
                query_parts.extend(str(s) for s in skills_sample)
            
            query = " ".join(query_parts)
            
            self._log_execution(f"RAG query for roadmap: '{query}'")
            
            # Retrieve documents (more than needed for richer context)
            rag_result = retrieve_documents(query, top_k=12)
            
            if not rag_result.get("success"):
                self._log_execution("RAG retrieval failed, using fallback", level="warning")
                return {"resources": [], "project_examples": [], "context_text": ""}
            
            # Extract learning resources
            resources = [
                {
                    "title": doc["title"],
                    "type": doc["category"],
                    "url": doc.get("metadata", {}).get("url", ""),
                    "description": doc["text"][:250] if len(doc["text"]) > 250 else doc["text"],
                    "relevance": doc["similarity"],
                }
                for doc in rag_result.get("documents", [])
                if doc["category"] in ["resource", "learning_path", "skill"]
            ]
            
            # Extract project examples (practical milestones)
            project_examples = [
                {
                    "title": doc["title"],
                    "description": doc["text"][:300] if len(doc["text"]) > 300 else doc["text"],
                    "skills_taught": doc.get("metadata", {}).get("skills", []),
                }
                for doc in rag_result.get("documents", [])
                if doc["category"] == "resource"
            ][:3]  # Top 3 project examples
            
            # Build context text for LLM (first 3 documents)
            context_texts = [
                f"Resource: {doc['title']}\n{doc['text'][:400]}"
                for doc in rag_result.get("documents", [])[:3]
            ]
            context_text = "\n\n".join(context_texts)
            
            return {
                "resources": resources,
                "project_examples": project_examples,
                "context_text": context_text,
            }
            
        except Exception as e:
            self._log_execution(f"Error retrieving RAG context for roadmap: {str(e)}", level="warning")
            return {"resources": [], "project_examples": [], "context_text": ""}
    
    def _generate_generic_roadmap(self, target_role: str, experience_level: str) -> list:
        """
        Generate generic roadmap phases based on target role when no specific skills provided.
        
        This ensures users always get a roadmap even if skill extraction fails.
        """
        # Generic phases that apply to most roles
        phases = [
            {
                "phase": 1,
                "title": "Fundamentals & Foundations",
                "duration_months": 2,
                "skills_to_learn": ["Core concepts", "Best practices", "Industry standards"],
                "difficulty": "beginner",
                "resources": ["Official documentation", "Online tutorials", "Beginner courses"],
                "milestones": ["Complete foundational course", "Build first project", "Understand core patterns"],
            },
            {
                "phase": 2,
                "title": "Intermediate Skills",
                "duration_months": 3,
                "skills_to_learn": ["Advanced techniques", "Problem-solving", "Code optimization"],
                "difficulty": "intermediate",
                "resources": ["Advanced courses", "Technical blogs", "Open source projects"],
                "milestones": ["Build 2-3 intermediate projects", "Review others' code", "Contribute to open source"],
            },
            {
                "phase": 3,
                "title": "Specialization & Mastery",
                "duration_months": 3,
                "skills_to_learn": ["Specialization", "System design", "Performance tuning"],
                "difficulty": "advanced",
                "resources": ["Specialized courses", "Research papers", "Expert mentorship"],
                "milestones": ["Build complex project", "Mentor others", "Publish case study"],
            },
        ]
        
        return phases
