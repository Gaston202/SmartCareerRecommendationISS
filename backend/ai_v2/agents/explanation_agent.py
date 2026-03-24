"""
Explanation Agent for AI v2 module - NEXT PHASE.

Provides detailed explanations for why specific careers were recommended.
Uses LLM to generate human-readable reasoning and comparative analysis.

Status: STRUCTURE READY, IMPLEMENTATION NEXT
    - Skeleton ready for OpenAI tool calling integration
    - Prepared for function_calling with extract_skills, get_career_requirements
    - TODO: Integrate with orchestrator
    - TODO: Add proper LLM explanation logic
    - TODO: Add tool-calling support
"""

from typing import Any, Dict, List, Optional

from ..schemas import AgentOutput, AgentType
from ..services import LLMService
from .base_agent import BaseAgent


class ExplanationAgent(BaseAgent):
    """
    Agent responsible for explaining career recommendations.
    
    Purpose:
        - Generate natural language explanations for career matches
        - Compare user profile against career requirements
        - Highlight key matching skills
        - Identify primary gaps and how to close them
        - Provide career trajectory and growth potential analysis
        - Answer "Why was this career recommended?" question
    
    LLM Integration (NEXT PHASE):
        - Uses OpenAI GPT-4 with tool calling capability
        - Can call:
            * extract_skills() → List user's actual skill levels
            * get_career_requirements() → Career-specific requirements
            * compute_skill_gap() → Detailed gap analysis
            * generate_roadmap() → Learning path recommendations
            * retrieve_documents() → RAG retrieval for salary, market data, etc.
    
    Output Format:
        {
            "career_role": "Backend Engineer",
            "match_score": 0.92,
            "explanation": "You are an excellent fit for Backend Engineer because...",
            "matching_aspects": [
                "Strong in Python programming",
                "Experience with databases",
                ...
            ],
            "growth_potential": "High - system design skills in demand",
            "timeline_to_readiness": 6 months,
            "next_steps": [...],
        }
    
    STATUS & TODO:
        - ✓ Agent structure created
        - ✓ Docstrings prepared
        - ✓ Tool-calling hooks defined
        - TODO: Implement OpenAI tool calling
        - TODO: Create tool handlers
        - TODO: Add to orchestrator pipeline
        - TODO: Add output validation
        - TODO: Add tests
    
    Next Implementation Priority:
        1. Implement _call_llm_with_tools() method
        2. Create tool handler functions
        3. Add to orchestrator (after roadmap agent)
        4. Test with real LLM tool calling
    """

    def __init__(self):
        """Initialize the ExplanationAgent."""
        super().__init__(
            agent_type=AgentType.EXPLANATION,  # Will need to add to AgentType enum
            name="Career Explanation Generator",
        )
        self.llm = LLMService()

    def run(self, input_data: Dict[str, Any]) -> AgentOutput:
        """
        Generate explanation for career recommendation using LLM tool calling.
        
        Args:
            input_data (Dict[str, Any]): Must contain:
                - career_recommendation: Career dict with role, confidence, etc.
                - user_profile: User's profile
                - user_skills: User's current skills  
                - required_skills: Skills needed for the career
                - (optional) market_data: Market trends and salary info
        
        Returns:
            AgentOutput: Detailed explanation of why career was recommended
        
        Example:
            >>> agent = ExplanationAgent()
            >>> result = agent.run({
            ...     "career_recommendation": {"role": "Backend Engineer", ...},
            ...     "user_profile": profile,
            ...     "user_skills": ["Python", "SQL"],
            ...     "required_skills": ["Python", "SQL", "Docker", ...],
            ... })
            >>> print(result.data["explanation"])
            "You are an excellent fit for Backend Engineer because..."
        """
        try:
            self._log_execution("Starting career explanation generation")

            career_rec = input_data.get("career_recommendation")
            user_profile = input_data.get("user_profile")
            user_skills = input_data.get("user_skills", [])
            required_skills = input_data.get("required_skills", [])
            market_data = input_data.get("market_data", {})
            
            if not career_rec or not career_rec.get("role"):
                raise ValueError("career_recommendation with role is required")
            
            target_role = career_rec.get("role")
            
            # Retrieve RAG context to ground explanation in real knowledge
            rag_context = self._get_rag_context(target_role, user_skills)
            
            # Generate explanation using LLM with RAG context
            # NEXT PHASE: Replace with actual OpenAI tool calling
            explanation_result = self._generate_explanation(
                target_role=target_role,
                user_skills=user_skills,
                required_skills=required_skills,
                user_profile=user_profile,
                market_data=market_data,
                career_match=career_rec.get("confidence", 0.75),
                rag_context=rag_context,  # NEW: Include RAG context
            )
            
            if not explanation_result.get("success"):
                raise ValueError("Failed to generate explanation")
            
            self._log_execution(f"Explanation generated for {target_role}")
            
            return self._create_output(
                success=True,
                data=explanation_result.get("data", {}),
            )

        except Exception as e:
            self._log_execution(f"Error during explanation generation: {str(e)}", level="error")
            return self._create_output(
                success=False,
                error=str(e),
            )

    # ========================================================================
    # Explanation Generation (NEXT PHASE: Replace with tool calling)
    # ========================================================================

    def _generate_explanation(
        self,
        target_role: str,
        user_skills: List[str],
        required_skills: List[str],
        user_profile: Dict[str, Any],
        market_data: Dict[str, Any],
        career_match: float,
        rag_context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Generate structured explanation for career recommendation.
        
        Output format:
        {
            "role": "Backend Engineer",
            "why_fit": "Your experience in Django and backend logic aligns...",
            "missing_skills_reason": "You lack SQL and API design...",
            "learning_strategy": "Start with REST APIs, then databases...",
            "confidence_explanation": "High match due to strong backend base"
        }
        
        NEXT PHASE:
            - Integrate with LLM tool calling for detailed analysis
            - Call extract_skills() for proficiency levels
            - Call get_career_requirements() for market data
            - Call retrieve_documents() for salary/trends
        """
        if rag_context is None:
            rag_context = {}
        
        self.logger.info(f"[EXPLANATION] Generating structured explanation for {target_role}")
        
        # Calculate matching and missing skills
        matching_skills = [
            s for s in user_skills if s.lower() in [r.lower() for r in required_skills]
        ]
        missing_skills = [
            s for s in required_skills if s.lower() not in [u.lower() for u in user_skills]
        ]
        
        experience_level = getattr(user_profile, 'experience_level', 'mid')
        match_percentage = int(career_match * 100)
        
        # Build structured explanation (optionally grounded in RAG context)
        why_fit = self._generate_why_fit(
            target_role, matching_skills, experience_level, match_percentage, rag_context
        )
        
        missing_skills_reason = self._generate_missing_skills_reason(
            missing_skills, target_role, rag_context
        )
        
        learning_strategy = self._generate_learning_strategy(
            missing_skills, target_role, rag_context
        )
        
        confidence_explanation = self._generate_confidence_explanation(
            career_match, match_percentage, len(matching_skills), len(required_skills), rag_context
        )
        
        return {
            "success": True,
            "data": {
                "role": target_role,
                "why_fit": why_fit,
                "missing_skills_reason": missing_skills_reason,
                "learning_strategy": learning_strategy,
                "confidence_explanation": confidence_explanation,
                # Keep additional fields for backwards compatibility
                "match_score": career_match,
                "matching_skills": matching_skills,
                "missing_skills": missing_skills[:3],
                "growth_potential": "High" if career_match > 0.8 else "Medium",
                "timeline_to_readiness": 6,
                "next_steps": [f"Learn {skill}" for skill in missing_skills[:2]],
                "rag_grounded": True,  # Mark that explanation is grounded in knowledge base
            },
        }
    
    def _get_rag_context(self, target_role: str, user_skills: List[str]) -> Dict[str, Any]:
        """
        Retrieve RAG context for a target role to ground explanations in real knowledge.
        
        Args:
            target_role: Career role to search for
            user_skills: User's current skills for context
            
        Returns:
            Dict with career info from knowledge base
        """
        try:
            from ..tools.base import retrieve_documents
            
            # Search for career role-specific information
            query = f"{target_role} skills requirements career path"
            rag_result = retrieve_documents(query, top_k=5)
            
            if not rag_result.get("success"):
                self._log_execution(f"RAG retrieval failed for {target_role}", level="warning")
                return {}
            
            # Extract relevant documents
            docs = rag_result.get("documents", [])
            
            return {
                "documents": docs[:3],  # Top 3 most relevant docs
                "role_description": docs[0]["text"][:300] if docs else "",
            }
        
        except Exception as e:
            self._log_execution(f"Error getting RAG context for {target_role}: {e}", level="warning")
            return {}
    
    def _generate_why_fit(
        self,
        target_role: str,
        matching_skills: List[str],
        experience_level: str,
        match_percentage: int,
        rag_context: Dict[str, Any] = None,
    ) -> str:
        """Generate explanation of why user is a good fit."""
        if rag_context is None:
            rag_context = {}
        
        if not matching_skills:
            base_explanation = (
                f"You have foundational potential for {target_role}. "
                f"Building the required skills will open this career path."
            )
            if rag_context.get("role_description"):
                base_explanation += (
                    f" {rag_context['role_description'][:100]}..."
                )
            return base_explanation
        
        core_skills = matching_skills[:2]
        skills_text = " and ".join(core_skills)
        
        explanation = (
            f"Your experience in {skills_text} aligns well with {target_role} requirements. "
            f"As a {experience_level}-level professional with {len(matching_skills)} "
            f"key skills already in place, you have a strong foundation for this role. "
            f"{match_percentage}% skill alignment indicates good career fit."
        )
        
        return explanation
    
    def _generate_missing_skills_reason(
        self,
        missing_skills: List[str],
        target_role: str,
        rag_context: Dict[str, Any] = None,
    ) -> str:
        """Generate explanation of why skills are missing and their importance."""
        if rag_context is None:
            rag_context = {}
        
        if not missing_skills:
            return "No significant skill gaps identified. You're well-prepared for this role!"
        
        top_gaps = missing_skills[:3]
        gap_text = ", ".join(top_gaps)
        
        explanation = (
            f"To excel as a {target_role}, you'll need to develop: {gap_text}. "
            f"These are critical because they directly impact day-to-day responsibilities "
            f"and career advancement potential in this field."
        )
        
        return explanation
    
    def _generate_learning_strategy(
        self,
        missing_skills: List[str],
        target_role: str,
        rag_context: Dict[str, Any] = None,
    ) -> str:
        """Generate actionable learning strategy to close gaps."""
        if rag_context is None:
            rag_context = {}
        
        if not missing_skills:
            return "Continue deepening your existing skills and explore advanced specializations."
        
        top_gaps = missing_skills[:3]
        strategy = f"To transition to {target_role}:\n"
        strategy += f"1. Start with {top_gaps[0]} (foundation)\n"
        
        if len(top_gaps) > 1:
            strategy += f"2. Build {top_gaps[1]} (intermediate)\n"
            if len(top_gaps) > 2:
                strategy += f"3. Master {top_gaps[2]} (advanced)\n"
        
        strategy += "4. Apply knowledge through portfolio projects\n"
        strategy += "5. Seek mentorship or join relevant communities"
        
        return strategy
    
    def _generate_confidence_explanation(
        self,
        career_match: float,
        match_percentage: int,
        matching_count: int,
        required_count: int,
        rag_context: Dict[str, Any] = None,
    ) -> str:
        """Generate explanation of confidence level."""
        if rag_context is None:
            rag_context = {}
        
        if career_match > 0.85:
            confidence = "Very High"
            reason = (
                f"You already possess {matching_count} of {required_count} core skills. "
                f"With focused effort on remaining gaps, transition is very achievable."
            )
        elif career_match > 0.70:
            confidence = "High"
            reason = (
                f"{match_percentage}% skill alignment provides a solid foundation. "
                f"Learning missing skills is realistic within 6 months."
            )
        elif career_match > 0.50:
            confidence = "Moderate"
            reason = (
                f"You have {matching_count} transferable skills. "
                f"This role is achievable with dedicated training, typically 6-12 months."
            )
        else:
            confidence = "Developing"
            reason = (
                f"This is a growth opportunity. While gaps exist, your profile shows "
                f"potential to develop into this role over time with structured learning."
            )
        
        return f"{confidence} confidence: {reason}"

    # ========================================================================
    # PLACEHOLDER: OpenAI Tool Calling (NEXT PHASE)
    # ========================================================================

    def _call_llm_with_tools(
        self,
        prompt: str,
        available_tools: List[str],
    ) -> Dict[str, Any]:
        """
        Call LLM with tool/function calling capability (NEXT PHASE).
        
        Args:
            prompt: Natural language prompt for the LLM
            available_tools: List of available tools (function names)
                - "extract_skills": Detailed skill extraction from CV
                - "get_career_requirements": S Market requirements for career
                - "compute_skill_gap": Analyze skill gaps
                - "generate_roadmap": Create learning roadmap
                - "retrieve_documents": RAG retrieval for knowledge base
        
        Returns:
            Response from LLM with tool calls and results
        
        TODO:
            1. Build prompt with tool descriptions
            2. Call OpenAI chat/completions with functions parameter
            3. Execute tool calls returned by LLM
            4. Feed results back to LLM for final explanation
            5. Validate and structure final output
        
        Example Call:
            response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                tools=[
                    {
                        "type": "function",
                        "function": {
                            "name": "extract_skills",
                            "description": "Extract skills from user profile",
                            "parameters": {...}
                        }
                    }
                ],
                tool_choice="auto"
            )
        """
        self.logger.warning(
            "[TODO] OpenAI tool calling not yet implemented. "
            "Return template explanation instead."
        )
        
        return {
            "success": False,
            "message": "Tool calling implementation pending",
        }
