"""
Profile Agent for AI v2 module.

Analyzes user profile to extract skills, experience, and preferences.
"""

from typing import Any, Dict, List

from ..schemas import AgentOutput, AgentType
from ..services import LLMService
from .base_agent import BaseAgent


class ProfileAgent(BaseAgent):
    """
    Agent responsible for analyzing and enriching user profile data.
    
    Purpose:
        - Extract relevant skills and experience from user profile
        - Categorize skills by proficiency level
        - Identify career preferences and constraints
        - Prepare profile for other agents in the pipeline
    
    TODO:
        - Integrate with user database
        - Implement skill extraction logic
        - Add proficiency level inference
        - Connect to job market data for skill trending
    """

    def __init__(self):
        """Initialize the ProfileAgent."""
        super().__init__(
            agent_type=AgentType.PROFILE,
            name="Profile Analyzer",
        )
        self.llm = LLMService()

    def run(self, input_data: Dict[str, Any]) -> AgentOutput:
        """
        Analyze user profile using LLM + RAG context.
        
        Args:
            input_data (Dict[str, Any]): Must contain 'user_profile' key with UserProfile object
        
        Returns:
            AgentOutput: Profile analysis result with skill categorization and insights
        
        Example:
            >>> agent = ProfileAgent()
            >>> result = agent.run({"user_profile": user_profile})
        """
        try:
            self._log_execution("Starting profile analysis with LLM + RAG")

            user_profile = input_data.get("user_profile")
            if not user_profile:
                raise ValueError("user_profile is required in input_data")

            # Extract preferences (separate from user_profile data)
            preferences = input_data.get("preferences", {}) or {}
            preferred_roles = preferences.get("preferred_roles", [])
            target_role = preferred_roles[0] if preferred_roles else "General Professional"

            # ================================================================
            # NEW: Retrieve market context from RAG knowledge base
            # ================================================================
            rag_context = self._get_rag_context_for_profile(user_profile, target_role)
            self._log_execution(
                f"Retrieved RAG context with {len(rag_context.get('resources', []))} resources"
            )

            # Use LLM to analyze and categorize skills
            llm_result = self.llm.analyze_skill_gaps(
                current_skills=user_profile.current_skills,
                target_role=target_role,
                required_skills=user_profile.current_skills,  # For context
                rag_context=str(rag_context),  # Pass RAG context for metadata-aware analysis
            )

            # Extract insights from LLM analysis
            profile_insights = {
                "skills_extracted": user_profile.current_skills,
                "skill_categories": self._categorize_skills(user_profile.current_skills),
                "experience_years": user_profile.experience_level,
                "career_stage": user_profile.experience_level,
                "preferred_roles": target_role,
                "market_demand": "high" if len(user_profile.current_skills) >= 3 else "medium",
                "profile_completeness": self._calculate_completeness(user_profile, preferences),
                "llm_insights": llm_result.get("recommendations", []),
                # NEW: Add RAG-enriched context
                "learning_resources": rag_context.get("resources", []),
                "skill_market_trends": rag_context.get("skill_trends", []),
                "rag_enriched": True,
            }

            self._log_execution("Profile analysis completed successfully (RAG-enriched)")

            return self._create_output(
                success=True,
                data=profile_insights,
            )

        except Exception as e:
            self._log_execution(f"Error during profile analysis: {str(e)}", level="error")
            return self._create_output(
                success=False,
                error=str(e),
            )
    
    def _get_rag_context_for_profile(self, user_profile: Any, target_role: str) -> Dict[str, Any]:
        """
        Retrieve learning resources and skill market trends from RAG.
        
        Args:
            user_profile: User profile object
            target_role: Target career role
            
        Returns:
            Dict with learning resources and skill trends
        """
        try:
            try:
                from ..tools.base import retrieve_documents
            except ImportError:
                self._log_execution("RAG tools module not available, using fallback", level="warning")
                return {"resources": [], "skill_trends": []}
            
            # Build query for learning resources and skill requirements
            query_parts = [
                target_role,
                "learning resources tutorials courses skills requirement",
            ]
            if user_profile.current_skills:
                # Get first 3 skills for query enrichment
                skills_sample = user_profile.current_skills[:3] if isinstance(user_profile.current_skills, list) else []
                if skills_sample:
                    query_parts.append(" ".join(str(s) for s in skills_sample))
            
            query = " ".join(query_parts)
            
            self._log_execution(f"RAG query for profile: '{query}'")
            
            rag_result = retrieve_documents(query, top_k=8)
            
            if not rag_result.get("success"):
                self._log_execution("RAG retrieval failed, using fallback", level="warning")
                return {"resources": [], "skill_trends": []}
            
            # Extract learning resources and skills
            resources = [
                {
                    "title": doc["title"],
                    "category": doc["category"],
                    "description": doc["text"][:300] if len(doc["text"]) > 300 else doc["text"],
                    "relevance": doc["similarity"],
                }
                for doc in rag_result.get("documents", [])
                if doc["category"] in ["resource", "learning_path"]
            ]
            
            # Extract skill trends (in-demand skills)
            skill_trends = list(set(
                doc["title"] for doc in rag_result.get("documents", [])
                if doc["category"] == "skill"
            ))[:5]  # Top 5 trending skills
            
            return {
                "resources": resources,
                "skill_trends": skill_trends,
                "context_text": " ".join([d["text"][:200] for d in rag_result.get("documents", [])[:3]]),
            }
            
        except Exception as e:
            self._log_execution(f"Error retrieving RAG context for profile: {str(e)}", level="warning")
            return {"resources": [], "skill_trends": []}
    
    def _categorize_skills(self, skills: list) -> Dict[str, list]:
        """Categorize skills by type."""
        technical_skills = []
        soft_skills = []
        
        technical_keywords = ["python", "java", "javascript", "sql", "react", "docker", "aws", "kubernetes"]
        
        for skill in skills:
            if any(tech.lower() in skill.lower() for tech in technical_keywords):
                technical_skills.append(skill)
            else:
                soft_skills.append(skill)
        
        return {
            "technical": technical_skills if technical_skills else skills[:len(skills)//2] or skills,
            "soft_skills": soft_skills if soft_skills else [],
        }
    
    def _calculate_completeness(self, user_profile, preferences: dict = None) -> float:
        """Calculate profile completeness percentage."""
        if preferences is None:
            preferences = {}
        
        score = 0.0
        if user_profile.current_skills:
            score += 25
        
        # Check if user has preferred roles in preferences
        preferred_roles = preferences.get("preferred_roles", [])
        if preferred_roles:
            score += 25
        
        # Check experience level (no years_of_experience attribute)
        if user_profile.experience_level:
            score += 25
        
        # Check education
        if user_profile.education:
            score += 25
        
        return score
