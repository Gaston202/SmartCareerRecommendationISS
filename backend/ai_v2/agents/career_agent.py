"""
Career Agent for AI v2 module - REFACTORED.

Recommends suitable career paths based on user profile and market data.
Uses LLM for intelligent recommendation generation.

Features:
    - Explicit real LLM path with error handling
    - Fallback to mock template data
    - Safe skill deduplication (no dict-in-set errors)
    - Clear logging to distinguish pipeline source
    - Consistent structured career output
"""

from typing import Any, Dict, List

from ..schemas import AgentOutput, AgentType
from ..services import LLMService
from ..services.fallback_utils import safe_extract_strings, safe_deduplicate_by_field
from .base_agent import BaseAgent


class CareerAgent(BaseAgent):
    """
    Agent responsible for career recommendation.
    
    Purpose:
        - Use LLM to generate personalized career recommendations
        - Match user skills with career opportunities
        - Score and rank career options
        - Consider user preferences and constraints
        - Provide detailed career information
    
    LLM Integration:
        - Uses OpenAI GPT-4 for recommendations (with mock fallback)
        - Generates structured career suggestions
        - Includes match scores and market data
    
    Error Handling:
        - API errors (quota, network, etc.) → fallback mock
        - Parse errors → fallback template careers
        - All errors logged with [FALLBACK_MOCK] tag
        - Pipeline continues regardless of LLM status
    
    TODO:
        - Build job market knowledge base (RAG)
        - Add market demand scoring
        - Filter careers by user preferences
        - Query salary and growth trends
        - EXPERIMENTAL: Multi-agent debate for career consensus
    """

    def __init__(self):
        """Initialize the CareerAgent."""
        super().__init__(
            agent_type=AgentType.CAREER,
            name="Career Recommender",
        )
        self.llm = LLMService()

    def run(self, input_data: Dict[str, Any]) -> AgentOutput:
        """
        Generate career recommendations using LLM + RAG context.
        
        Args:
            input_data (Dict[str, Any]): Must contain:
                - user_profile: UserProfile object
                - (optional) cv_data: CV analysis results
                - (optional) preferences: Career preferences
        
        Returns:
            AgentOutput: Career recommendations with match scores and context
        
        Flow:
            1. Extract user skills from profile + CV
            2. Retrieve relevant careers from RAG knowledge base
            3. Use LLM to rank and explain recommendations
            4. Return structured career options with reasoning
        
        Example:
            >>> agent = CareerAgent()
            >>> result = agent.run({"user_profile": profile})
            >>> print(result.data["recommended_careers"])
        """
        try:
            self._log_execution("Starting career recommendation with RAG + LLM")

            user_profile = input_data.get("user_profile")
            cv_data = input_data.get("cv_data", {})
            preferences = input_data.get("preferences", {})
            
            if not user_profile:
                raise ValueError("user_profile is required")
            
            # Extract skills from profile and CV (safely handle dicts/strings)
            user_skills = user_profile.current_skills or []
            cv_skills = cv_data.get("skills_extracted", [])
            
            # SAFE SKILL EXTRACTION: Convert any dicts to strings, preserve strings
            user_skills_safe = safe_extract_strings(user_skills, fallback=[])
            cv_skills_safe = safe_extract_strings(cv_skills, fallback=[])
            
            # SAFE DEDUPLICATION: Use list(dict.fromkeys()) instead of set() to preserve order
            # This avoids "cannot use 'dict' as a set element" error
            all_skills = list(dict.fromkeys(user_skills_safe + cv_skills_safe))
            
            self._log_execution(
                f"Extracted {len(user_skills_safe)} user skills, "
                f"{len(cv_skills_safe)} CV skills → {len(all_skills)} unique skills"
            )
            
            # ================================================================
            # NEW: Retrieve career context from RAG knowledge base
            # ================================================================
            rag_context = self._get_rag_context(all_skills, user_profile)
            self._log_execution(
                f"Retrieved {len(rag_context.get('careers', []))} careers from RAG"
            )
            
            # Get market data (can be enriched from RAG)
            job_market_data = input_data.get("job_market_data")
            
            # Enhance market data with RAG context
            if not job_market_data and rag_context.get("careers"):
                job_market_data = {
                    "careers_in_market": [c["title"] for c in rag_context["careers"]],
                    "skills_in_demand": rag_context.get("skills_in_demand", []),
                }
            
            # Use LLM to generate recommendations
            # Pass RAG context so LLM grounds recommendations in real market knowledge
            rag_context_text = rag_context.get("context_text", "")
            
            llm_result = self.llm.generate_recommendations(
                user_profile={
                    "experience_level": user_profile.experience_level,
                    "education": user_profile.education,
                    "preferences": preferences,
                },
                user_skills=all_skills,
                job_market_data=job_market_data,
                count=3,  # Generate 3 recommendations
                rag_context=rag_context_text,  # NEW: Inject RAG knowledge into LLM prompt
            )
            
            if not llm_result.get("success"):
                raise ValueError("LLM failed to generate recommendations")
            
            # Extract career recommendations (may be from real LLM or fallback)
            recommended_careers = llm_result.get("recommended_careers", [])
            llm_source = llm_result.get("source", "unknown")
            
            # SAFE DEDUPLICATION: Remove duplicate careers by role
            # Handles case where LLM returns duplicate career suggestions
            recommended_careers = safe_deduplicate_by_field(
                [c for c in recommended_careers if isinstance(c, dict)],
                field_key="role",
                keep_first=True,
            )
            
            # Enrich recommendations with RAG context
            recommended_careers = self._enrich_careers_with_rag(recommended_careers, rag_context)
            
            # Structure career recommendations
            career_recommendations = {
                "recommended_careers": recommended_careers,
                "primary_recommendation": recommended_careers[0] if recommended_careers else None,
                "confidence_score": llm_result.get("confidence_score", 0.75),
                "reasoning": llm_result.get("reasoning", "Generated by AI with market data"),
                "user_skills": all_skills,
                "llm_source": llm_source,  # Track which path was used (for debugging)
                "rag_enriched": True,  # Mark that this was enriched with RAG context
            }
            
            self._log_execution(
                f"Career recommendation completed - {len(recommended_careers)} careers recommended "
                f"(source: {llm_source}, RAG-enriched)"
            )
            
            return self._create_output(
                success=True,
                data=career_recommendations,
            )

        except Exception as e:
            self._log_execution(f"Error during career recommendation: {str(e)}", level="error")
            return self._create_output(
                success=False,
                error=str(e),
            )
    
    def _get_rag_context(self, skills: List[str], user_profile: Any) -> Dict[str, Any]:
        """
        Retrieve career context from RAG knowledge base.
        
        Args:
            skills: User's skills
            user_profile: User profile object
            
        Returns:
            Dict with relevant careers, skills, learning paths, and raw documents for LLM context
        """
        try:
            try:
                from ..tools.base import retrieve_documents
            except ImportError:
                self._log_execution("RAG tools module not available, using fallback", level="warning")
                return {}
            
            # IMPROVED QUERY: Include role preference + skills + requirements + path
            # This provides better semantic matching against career documents
            target_role = "software engineer"  # Default fallback
            if hasattr(user_profile, 'preferred_roles') and user_profile.preferred_roles:
                target_role = user_profile.preferred_roles[0]
            
            # Build rich query combining role, skills, requirements, and career path
            query_parts = [
                target_role,
                "skills requirements learning path career progression",
            ]
            if skills:
                query_parts.append(f"{' '.join(skills[:3])}")
            query = " ".join(query_parts)
            
            self._log_execution(f"RAG query: '{query}'")
            
            rag_result = retrieve_documents(query, top_k=10)  # Increased from 5 to 10 for better context
            
            if not rag_result.get("success"):
                self._log_execution("RAG retrieval failed, using fallback", level="warning")
                return {}
            
            # Extract career documents
            careers = [
                {
                    "id": doc["id"],
                    "title": doc["title"],
                    "category": doc["category"],
                    "description": doc["text"][:200],  # Truncate for context
                    "metadata": doc["metadata"],
                    "relevance": doc["similarity"],
                }
                for doc in rag_result.get("documents", [])
                if doc["category"] == "career"
            ]
            
            # Extract skills mentioned in context
            skills_in_demand = list(set(
                doc["title"] for doc in rag_result.get("documents", [])
                if doc["category"] == "skill"
            ))
            
            # Build context string for LLM from raw documents
            # This gives the LLM concrete knowledge to ground recommendations in
            context_documents = rag_result.get("documents", [])[:8]  # Top 8 most relevant docs
            rag_context_text = self._build_rag_context_string(context_documents)
            
            return {
                "careers": careers,
                "skills_in_demand": skills_in_demand,
                "rag_backend": rag_result.get("backend", "unknown"),
                "context_text": rag_context_text,  # For injection into LLM prompt
                "raw_documents": context_documents,  # For potential further enrichment
            }
        
        except Exception as e:
            self._log_execution(f"Error getting RAG context: {e}", level="warning")
            return {}
    
    def _build_rag_context_string(self, documents: List[Dict[str, Any]]) -> str:
        """
        Build a formatted context string from retrieved RAG documents.
        
        This string will be injected into the LLM prompt to ground
        recommendations in real knowledge base data.
        
        Args:
            documents: List of document objects from RAG retrieval
            
        Returns:
            Formatted context string for LLM
        """
        if not documents:
            return ""
        
        context_lines = []
        for doc in documents[:8]:  # Use top 8 docs to avoid overwhelming the LLM
            title = doc.get("title", "Unknown")
            category = doc.get("category", "document")
            text = doc.get("text", "")[:300]  # Truncate to 300 chars per doc
            similarity = doc.get("similarity", 0)
            
            # Format: Category - Title (relevance score)
            # Content: Text excerpt
            context_lines.append(
                f"• {category.title()}: {title} (relevance: {similarity:.2f})\n  {text}..."
            )
        
        return "\n".join(context_lines)
    
    def _enrich_careers_with_rag(
        self,
        careers: List[Dict[str, Any]],
        rag_context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Enrich career recommendations with RAG context information.
        
        Args:
            careers: Career recommendations from LLM
            rag_context: Context from RAG retrieval
            
        Returns:
            Enriched career recommendations
        """
        if not rag_context.get("careers"):
            return careers
        
        # Create map of careers from RAG for quick lookup
        rag_careers = {c["title"].lower(): c for c in rag_context["careers"]}
        
        # Enrich each recommended career
        for career in careers:
            role = career.get("role", "").lower()
            
            # Find matching career in RAG context
            matching_rag_career = None
            for rag_career_title, rag_career in rag_careers.items():
                if role in rag_career_title or rag_career_title in role:
                    matching_rag_career = rag_career
                    break
            
            if matching_rag_career:
                # Add RAG-sourced information
                career["market_data"] = matching_rag_career.get("metadata", {})
                career["description"] = matching_rag_career.get("description", career.get("description"))
                career["relevance_score"] = matching_rag_career.get("relevance", 0.0)
        
        return careers
