"""
LLM Service for AI v2 module - REFACTORED.

Provides unified interface to LLM providers (OpenAI, Anthropic, etc.)
with explicit error handling, centralized fallback logic, and clear logging.

Error Handling Strategy:
    - Specific error categorization (quota, network, parse, etc.)
    - Centralized fallback for all methods
    - Clear logging to distinguish: REAL_LLM vs FALLBACK_MOCK vs TOOL_PIPELINE
    - Graceful degradation without breaking the pipeline
    
Fallback Behavior:
    API errors → Mock implementations with explicit logging
    Parse errors → Fallback template data
    All failures preserve schema consistency
"""

from typing import Optional, List, Dict, Any
import json
from ..config import config
from ..utils import get_logger
from .fallback_utils import (
    categorize_llm_error,
    LLMErrorType,
    LLMError,
    safe_parse_json,
    create_fallback_career_recommendation,
    create_fallback_gap_analysis,
    create_fallback_roadmap,
)

logger = get_logger(__name__)


def safe_deduplicate_careers(careers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Safely deduplicate a list of career dicts by role name.
    
    ✅ FIXED: Avoids `set(dicts)` which fails because dicts aren't hashable
    
    Args:
        careers: List of career dicts with "role" field
    
    Returns:
        List of deduplicated careers preserving order
    
    Example:
        >>> careers = [
        ...     {"role": "Backend Engineer", "salary": 100},
        ...     {"role": "Backend Engineer", "salary": 110},
        ...     {"role": "Frontend Engineer", "salary": 95},
        ... ]
        >>> deduplicated = safe_deduplicate_careers(careers)
        >>> len(deduplicated)  # 2 (Backend and Frontend, first Backend kept)
        2
    """
    seen = set()
    unique_careers = []
    for career in careers:
        if isinstance(career, dict):
            role = career.get("role", "")
            if role and role not in seen:
                seen.add(role)
                unique_careers.append(career)
        else:
            # If not a dict, still try to add it (shouldn't happen)
            unique_careers.append(career)
    
    return unique_careers


class LLMService:
    """
    Service for interacting with LLM providers with comprehensive error handling.
    
    Features:
        - OpenAI GPT-4/GPT-3.5 support with explicit error classification
        - Graceful fallback to mock implementations on API failures
        - Structured output with JSON parsing and validation
        - Clear logging: [REAL_LLM], [FALLBACK_MOCK], [TOOL_PIPELINE]
        - All methods return consistent schema regardless of source
    
    Usage:
        >>> llm = LLMService()
        >>> response = llm.generate_recommendations(
        ...     user_profile=profile,
        ...     user_skills=skills
        ... )
        >>> # Works same way whether via real API, fallback mock, or error
    
    Status:
        - ✓ OpenAI integration with error handling
        - ✓ Centralized mock implementations
        - ✓ Safe fallback on any failure
        - TODO: Streaming support for long responses
        - TODO: Retry logic with exponential backoff
        - TODO: Token counting for cost estimation
        - TODO: Support for Anthropic Claude
        - TODO: OpenAI tool/function calling (next phase)
    """
    
    def __init__(self):
        """Initialize LLM service with OpenRouter client and error handling."""
        self.logger = get_logger(__name__)
        self.use_mock = not config.OPENROUTER_API_KEY
        self.client = None
        
        # Try to initialize OpenAI client with OpenRouter endpoint
        if not self.use_mock:
            try:
                import openai
                self.client = openai.OpenAI(
                    api_key=config.OPENROUTER_API_KEY,
                    base_url=config.OPENROUTER_BASE_URL,
                )
                self.logger.info("✓ [REAL_LLM] OpenRouter client initialized - ready for API calls")
            except ImportError:
                self.logger.warning(
                    "[FALLBACK_MOCK] OpenAI library not installed, "
                    "will use mock implementations"
                )
                self.use_mock = True
            except Exception as e:
                self.logger.error(
                    f"[FALLBACK_MOCK] Failed to initialize OpenRouter client: {e}, "
                    "will use mock implementations"
                )
                self.use_mock = True
        else:
            self.logger.warning(
                "[FALLBACK_MOCK] OPENROUTER_API_KEY not configured, "
                "using mock LLM implementations for testing/development"
            )
    
    # ========================================================================
    # Public API Methods
    # ========================================================================
    
    def generate_recommendations(
        self,
        user_profile: Dict[str, Any],
        user_skills: List[str],
        job_market_data: Optional[List[str]] = None,
        count: int = 3,
        rag_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate career recommendations using LLM, optionally grounded in RAG context.
        
        Args:
            user_profile (Dict): User profile with experience, education, etc.
            user_skills (List[str]): User's current skills
            job_market_data (Optional[List[str]]): Market trends
            count (int): Number of recommendations to generate
            rag_context (Optional[str]): Retrieved documents context from RAG system
        
        Returns:
            Dict with:
            - success (bool): Whether generation succeeded
            - recommended_careers (List[Dict]): Career recommendations with roles, skills, confidence
            - confidence_score (float): Overall confidence 0-1
            - reasoning (str): Why these careers were recommended
            - source (str): "real_llm", "fallback_mock", or "parse_error"
        
        Example:
            >>> result = llm.generate_recommendations(
            ...     user_profile={"experience_level": "mid"},
            ...     user_skills=["Python", "SQL"],
            ...     count=3,
            ...     rag_context="Backend engineers typically require Python, PostgreSQL, Docker..."
            ... )
            >>> print(f"Got {len(result['recommended_careers'])} recommendations")
        """
        if self.use_mock:
            return self._mock_generate_recommendations(user_profile, user_skills, count)
        
        try:
            self.logger.debug("[REAL_LLM] Calling OpenRouter for career recommendations")
            
            prompt = self._build_recommendation_prompt(
                user_profile, user_skills, job_market_data, count, rag_context
            )
            
            response = self._safe_api_call(
                lambda: self.client.chat.completions.create(
                    model=config.LLM_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=1000,
                )
            )
            
            if response is None:
                # API call failed, use fallback
                return self._mock_generate_recommendations(user_profile, user_skills, count)
            
            result_text = response.choices[0].message.content
            self.logger.info(f"[REAL_LLM] ✓ Generated {count} recommendations from OpenRouter")
            
            # Parse JSON response
            parsed = safe_parse_json(result_text)
            
            if not parsed:
                self.logger.warning(
                    "[FALLBACK_MOCK] Failed to parse OpenRouter JSON response, "
                    "using career template instead"
                )
                return self._create_parse_error_fallback(
                    "recommendations", user_profile, user_skills, count
                )
            
            return {
                "success": True,
                "recommended_careers": safe_deduplicate_careers(parsed.get("recommended_careers", [])),
                "confidence_score": parsed.get("confidence_score", 0.75),
                "reasoning": parsed.get("reasoning", "Generated by OpenRouter"),
                "source": "real_llm",
            }
        
        except Exception as e:
            self.logger.error(
                f"[FALLBACK_MOCK] Unexpected error in generate_recommendations: {e}. "
                f"Falling back to mock implementation."
            )
            return self._mock_generate_recommendations(user_profile, user_skills, count)
    
    def analyze_skill_gaps(
        self,
        current_skills: List[str],
        target_role: str,
        required_skills: List[str],
    ) -> Dict[str, Any]:
        """
        Analyze skill gaps using LLM.
        
        Args:
            current_skills (List[str]): User's current skills
            target_role (str): Target job role
            required_skills (List[str]): Skills required for role
        
        Returns:
            Dict with:
            - success (bool): Analysis succeeded
            - gap_analysis (List[str]): Skills to learn
            - priority_gaps (List[str]): High-priority skills
            - timeline_months (int): Estimated learning time
            - recommendations (List[str]): Learning recommendations
            - source (str): Source of analysis
        """
        if self.use_mock:
            return self._mock_analyze_skill_gaps(
                current_skills, target_role, required_skills
            )
        
        try:
            self.logger.debug(f"[REAL_LLM] Analyzing skill gaps for {target_role}")
            
            prompt = self._build_gap_analysis_prompt(
                current_skills, target_role, required_skills
            )
            
            response = self._safe_api_call(
                lambda: self.client.chat.completions.create(
                    model=config.LLM_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=1500,
                )
            )
            
            if response is None:
                return self._mock_analyze_skill_gaps(
                    current_skills, target_role, required_skills
                )
            
            result_text = response.choices[0].message.content
            self.logger.info(f"[REAL_LLM] ✓ Analyzed gaps for {target_role}")
            
            parsed = safe_parse_json(result_text)
            
            if not parsed:
                self.logger.warning(
                    f"[FALLBACK_MOCK] Failed to parse gap analysis for {target_role}, "
                    "using template"
                )
                return self._create_parse_error_fallback(
                    "gap_analysis", current_skills, target_role, required_skills
                )
            
            return {
                "success": True,
                "gap_analysis": parsed.get("gap_analysis", []),
                "priority_gaps": parsed.get("priority_gaps", []),
                "timeline_months": parsed.get("timeline_months", 6),
                "recommendations": parsed.get("recommendations", []),
                "source": "real_llm",
            }
        
        except Exception as e:
            self.logger.error(
                f"[FALLBACK_MOCK] Unexpected error in analyze_skill_gaps: {e}. "
                f"Falling back to mock."
            )
            return self._mock_analyze_skill_gaps(
                current_skills, target_role, required_skills
            )
    
    def extract_skills_from_cv(self, cv_text: str) -> Dict[str, Any]:
        """
        Extract skills from CV text using LLM.
        
        Args:
            cv_text (str): Raw CV text to analyze
        
        Returns:
            Dict with:
            - success (bool): Extraction succeeded
            - skills (List[str]): Extracted skills
            - source (str): Source of extraction
        """
        if self.use_mock:
            return self._mock_extract_skills_from_cv(cv_text)
        
        try:
            self.logger.debug("[REAL_LLM] Extracting skills from CV text")
            
            prompt = f"""
You are an expert CV analyzer. Extract all technical and professional skills from the following CV text.

CV TEXT:
{cv_text}

TASK:
1. Identify all technical skills (programming languages, frameworks, tools, etc.)
2. Identify professional skills (communication, leadership, project management, etc.)
3. Return ONLY a valid JSON with no explanations

Return EXACTLY in this JSON format:
{{
    "skills": ["Skill1", "Skill2", "Skill3"]
}}
            """
            
            response = self._safe_api_call(
                lambda: self.client.chat.completions.create(
                    model=config.LLM_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=500,
                )
            )
            
            if response is None:
                return self._mock_extract_skills_from_cv(cv_text)
            
            result_text = response.choices[0].message.content
            self.logger.info("[REAL_LLM] ✓ Extracted skills from CV")
            
            parsed = safe_parse_json(result_text)
            
            if not parsed:
                self.logger.warning(
                    "[FALLBACK_MOCK] Failed to parse CV skill extraction, using mock"
                )
                return self._mock_extract_skills_from_cv(cv_text)
            
            return {
                "success": True,
                "skills": parsed.get("skills", []),
                "source": "real_llm",
            }
        
        except Exception as e:
            self.logger.error(
                f"[FALLBACK_MOCK] Unexpected error in extract_skills_from_cv: {e}. "
                f"Falling back to mock."
            )
            return self._mock_extract_skills_from_cv(cv_text)
    
    def generate_learning_roadmap(
        self,
        target_role: str,
        missing_skills: List[str],
        current_experience: str,
    ) -> Dict[str, Any]:
        """
        Generate personalized learning roadmap using LLM.
        
        Args:
            target_role (str): Target career role
            missing_skills (List[str]): Skills to learn
            current_experience (str): Current experience level
        
        Returns:
            Dict with:
            - success (bool): Roadmap generated
            - phases (List[Dict]): Learning phases with skills and timeline
            - total_months (int): Total learning time
            - resources (List[str]): Learning resources
            - milestones (List[str]): Key milestones
            - source (str): Source of roadmap
        """
        if self.use_mock:
            return self._mock_generate_roadmap(
                target_role, missing_skills, current_experience
            )
        
        try:
            self.logger.debug(f"[REAL_LLM] Generating roadmap for {target_role}")
            
            prompt = self._build_roadmap_prompt(
                target_role, missing_skills, current_experience
            )
            
            response = self._safe_api_call(
                lambda: self.client.chat.completions.create(
                    model=config.LLM_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000,
                )
            )
            
            if response is None:
                return self._mock_generate_roadmap(
                    target_role, missing_skills, current_experience
                )
            
            result_text = response.choices[0].message.content
            self.logger.info(f"[REAL_LLM] ✓ Generated roadmap for {target_role}")
            
            parsed = safe_parse_json(result_text)
            
            if not parsed:
                self.logger.warning(
                    f"[FALLBACK_MOCK] Failed to parse roadmap for {target_role}, "
                    "using template"
                )
                return self._create_parse_error_fallback(
                    "roadmap", target_role, missing_skills, current_experience
                )
            
            return {
                "success": True,
                "phases": parsed.get("phases", []),
                "total_months": parsed.get("total_months", 12),
                "resources": parsed.get("resources", []),
                "milestones": parsed.get("milestones", []),
                "source": "real_llm",
            }
        
        except Exception as e:
            self.logger.error(
                f"[FALLBACK_MOCK] Unexpected error in generate_learning_roadmap: {e}. "
                f"Falling back to mock."
            )
            return self._mock_generate_roadmap(
                target_role, missing_skills, current_experience
            )
    
    # ========================================================================
    # Error Handling & Safe API Calls
    # ========================================================================
    
    def _safe_api_call(self, api_call_func):
        """
        Execute API call with comprehensive error handling.
        
        Args:
            api_call_func: Callable that makes the API call
        
        Returns:
            API response or None if error occurred (will trigger fallback)
        """
        try:
            return api_call_func()
        except Exception as e:
            llm_error = categorize_llm_error(e)
            
            # Log with categorized error type
            if llm_error.error_type == LLMErrorType.QUOTA_EXCEEDED:
                self.logger.error(
                    f"[FALLBACK_MOCK] API QUOTA EXCEEDED (429). "
                    f"Account has insufficient credits/quota. Will use mock data. "
                    f"Error: {llm_error}"
                )
                self.use_mock = True  # Switch to mock mode
            
            elif llm_error.error_type == LLMErrorType.RATE_LIMIT:
                self.logger.warning(
                    f"[FALLBACK_MOCK] API RATE LIMITED (429). "
                    f"Too many requests. Falling back to mock. Error: {llm_error}"
                )
            
            elif llm_error.error_type == LLMErrorType.API_KEY_INVALID:
                self.logger.error(
                    f"[FALLBACK_MOCK] Invalid API key (401). Check OPENROUTER_API_KEY. "
                    f"Using mock data. Error: {llm_error}"
                )
                self.use_mock = True
            
            elif llm_error.error_type == LLMErrorType.MODEL_NOT_FOUND:
                self.logger.error(
                    f"[FALLBACK_MOCK] Model '{config.LLM_MODEL}' not found (404). "
                    f"Using mock data. Error: {llm_error}"
                )
                self.use_mock = True
            
            elif llm_error.error_type == LLMErrorType.CONTEXT_LENGTH:
                self.logger.warning(
                    f"[FALLBACK_MOCK] Request exceeds context length. "
                    f"Using mock data. Error: {llm_error}"
                )
            
            elif llm_error.error_type == LLMErrorType.TIMEOUT:
                self.logger.warning(
                    f"[FALLBACK_MOCK] API call timed out. Using mock data. "
                    f"Error: {llm_error}"
                )
            
            elif llm_error.error_type == LLMErrorType.NETWORK_ERROR:
                self.logger.warning(
                    f"[FALLBACK_MOCK] Network error connecting to API. "
                    f"Using mock data. Error: {llm_error}"
                )
            
            else:
                self.logger.error(
                    f"[FALLBACK_MOCK] Unexpected API error: {llm_error}. "
                    f"Using mock data."
                )
            
            return None  # Signal caller to use fallback
    
    def _create_parse_error_fallback(
        self,
        method_type: str,
        *args,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Create fallback data when JSON parsing fails after successful API call.
        
        Args:
            method_type: "recommendations", "gap_analysis", or "roadmap"
            *args: Arguments to the original method
        
        Returns:
            Valid fallback response matching expected schema
        """
        if method_type == "recommendations":
            user_profile, user_skills, count = args
            fallback = {
                "success": True,
                "recommended_careers": [
                    create_fallback_career_recommendation(
                        role=role,
                        confidence=0.65 - (i * 0.1),
                    )
                    for i, role in enumerate(["Backend Engineer", "Full-Stack Developer", "Data Engineer"][:count])
                ],
                "confidence_score": 0.65,
                "reasoning": "Generated from fallback template (parse error)",
                "source": "parse_error_fallback",
            }
        
        elif method_type == "gap_analysis":
            current_skills, target_role, required_skills = args
            fallback = create_fallback_gap_analysis(
                current_skills, required_skills, target_role
            )
            fallback["source"] = "parse_error_fallback"
        
        elif method_type == "roadmap":
            target_role, missing_skills, current_experience = args
            fallback = create_fallback_roadmap(
                target_role, missing_skills, current_experience
            )
            fallback["source"] = "parse_error_fallback"
        
        else:
            fallback = {"success": False, "error": f"Unknown method type: {method_type}"}
        
        return fallback
    
    # ========================================================================
    # Mock Implementations (centralized fallback)
    # ========================================================================
    
    def _mock_extract_skills_from_cv(self, cv_text: str) -> Dict[str, Any]:
        """Mock implementation of skill extraction from CV."""
        self.logger.info("[FALLBACK_MOCK] Extracting skills from CV (mock template)")
        
        # Simple regex-based skill detection for mock
        common_skills = [
            "Python", "JavaScript", "React", "Node.js", "SQL", "Docker", 
            "AWS", "Git", "REST APIs", "TypeScript", "Java", "C++",
            "PostgreSQL", "MongoDB", "Linux", "Kubernetes", "CI/CD",
            "HTML", "CSS", "Vue", "Angular", "Express", "FastAPI"
        ]
        
        # Find which common skills appear in CV
        detected_skills = [
            skill for skill in common_skills 
            if skill.lower() in cv_text.lower()
        ]
        
        # If no skills detected, return generic backend skills
        if not detected_skills:
            detected_skills = ["Python", "REST APIs", "Database Design"]
        
        return {
            "success": True,
            "skills": detected_skills[:15],  # Top 15 skills
            "source": "fallback_mock",
        }
    
    def _mock_generate_recommendations(
        self,
        user_profile: Dict[str, Any],
        user_skills: List[str],
        count: int,
    ) -> Dict[str, Any]:
        """Mock implementation of career recommendations."""
        self.logger.info(
            f"[FALLBACK_MOCK] Generating {count} career recommendations "
            f"(mock template)"
        )
        
        career_profiles = [
            {
                "role": "Backend Engineer",
                "match_score": 0.92,
                "growth_trajectory": "Junior → Senior Backend Engineer → Tech Lead",
                "salary_range": "$70k - $120k",
                "market_demand": "high",
                "description": "Strong match for backend development with system design focus",
                "required_skills": ["Python", "SQL", "Docker", "REST APIs", "System Design"],
            },
            {
                "role": "Full-Stack Developer",
                "match_score": 0.85,
                "growth_trajectory": "Junior → Senior Full-Stack → Architect",
                "salary_range": "$65k - $110k",
                "market_demand": "high",
                "description": "Good fit for end-to-end development across stack",
                "required_skills": ["JavaScript", "React", "Node.js", "SQL", "HTML/CSS"],
            },
            {
                "role": "DevOps Engineer",
                "match_score": 0.78,
                "growth_trajectory": "Junior → Senior DevOps → Platform Engineer",
                "salary_range": "$75k - $125k",
                "market_demand": "high",
                "description": "Suitable for infrastructure and deployment focus",
                "required_skills": ["Docker", "Kubernetes", "CI/CD", "AWS", "Linux"],
            },
            {
                "role": "Data Engineer",
                "match_score": 0.75,
                "growth_trajectory": "Junior → Senior Data Engineer → Data Architect",
                "salary_range": "$70k - $115k",
                "market_demand": "medium",
                "description": "Match for data processing and pipeline work",
                "required_skills": ["Python", "SQL", "Spark", "Data Pipelines", "ETL"],
            },
            {
                "role": "ML Engineer",
                "match_score": 0.72,
                "growth_trajectory": "Junior → Senior ML Engineer → AI Research Lead",
                "salary_range": "$80k - $130k",
                "market_demand": "high",
                "description": "Potential for machine learning specialization",
                "required_skills": ["Python", "TensorFlow", "PyTorch", "Statistics", "Data Science"],
            },
        ]
        
        recommended = career_profiles[:count]
        
        return {
            "success": True,
            "recommended_careers": safe_deduplicate_careers(recommended),
            "confidence_score": 0.75,
            "reasoning": f"Mock recommendations based on {len(user_skills)} identified skills",
            "source": "fallback_mock",
        }
    
    def _mock_analyze_skill_gaps(
        self,
        current_skills: List[str],
        target_role: str,
        required_skills: List[str],
    ) -> Dict[str, Any]:
        """Mock implementation of skill gap analysis."""
        self.logger.info(
            f"[FALLBACK_MOCK] Analyzing skill gaps for {target_role} (mock template)"
        )
        
        gaps = [
            s for s in required_skills
            if s.lower() not in [c.lower() for c in current_skills]
        ]
        
        return {
            "success": True,
            "gap_analysis": gaps[:5],
            "priority_gaps": gaps[:3],
            "timeline_months": 6,
            "recommendations": [f"Learn {skill}" for skill in gaps[:3]],
            "source": "fallback_mock",
        }
    
    def _mock_generate_roadmap(
        self,
        target_role: str,
        missing_skills: List[str],
        current_experience: str,
    ) -> Dict[str, Any]:
        """Mock implementation of roadmap generation."""
        self.logger.info(
            f"[FALLBACK_MOCK] Generating roadmap for {target_role} "
            f"({current_experience} level, mock template)"
        )
        
        phases = [
            {
                "phase": 1,
                "title": "Foundation",
                "duration_months": 2,
                "skills": missing_skills[:2],
                "resources": ["Udemy", "Official Docs"],
            },
            {
                "phase": 2,
                "title": "Intermediate",
                "duration_months": 3,
                "skills": missing_skills[2:4],
                "resources": ["Advanced Courses", "Projects"],
            },
            {
                "phase": 3,
                "title": "Advanced",
                "duration_months": 3,
                "skills": missing_skills[4:],
                "resources": ["Research Papers", "Production Work"],
            },
        ]
        
        return {
            "success": True,
            "phases": phases,
            "total_months": 8,
            "resources": ["Udemy", "Coursera", "Documentation"],
            "milestones": ["Complete Phase 1", "Build Project", "Complete Phase 3"],
            "source": "fallback_mock",
        }
    
    # ========================================================================
    # Prompt Building
    # ========================================================================
    
    def _build_recommendation_prompt(
        self,
        user_profile: Dict[str, Any],
        user_skills: List[str],
        job_market_data: Optional[List[str]],
        count: int,
        rag_context: Optional[str] = None,
    ) -> str:
        """Build prompt for career recommendations with required skills, optionally grounded in RAG context."""
        rag_section = ""
        if rag_context:
            rag_section = f"""
INDUSTRY KNOWLEDGE BASE (from career knowledge database):
{rag_context}

Use this knowledge base to ground your recommendations in real market data and requirements.
"""
        
        return f"""
You are an expert career advisor analyzing a professional's background to recommend suitable career paths.

USER PROFILE:
- Experience Level: {user_profile.get('experience_level', 'mid')} (entry/mid/senior)
- Education: {user_profile.get('education', 'Bachelor')}
- Current Skills: {', '.join(user_skills) if user_skills else 'Not specified'}
- Preferences: {user_profile.get('preferences', {{}})}
{rag_section}

TASK:
1. Analyze the user's profile and skills carefully
2. Consider market demand and growth potential
3. Recommend {count} career paths that align with their background
4. For each recommendation, identify specific required skills for success
5. Provide realistic confidence scores based on skill overlap

IMPORTANT:
- Be specific and realistic about required skills
- Consider career progression from {user_profile.get('experience_level', 'mid')} level
- Prioritize roles with strong market demand
- Return ONLY valid JSON, no explanations

Respond EXACTLY in this JSON format:
{{
    "recommended_careers": [
        {{
            "role": "Career Title",
            "match_score": 0.85,
            "growth_trajectory": "Junior → Senior → Lead",
            "salary_range": "$70k - $110k",
            "market_demand": "high",
            "description": "Why this is suitable for the user",
            "required_skills": ["Skill1", "Skill2", "Skill3"]
        }}
    ],
    "confidence_score": 0.85,
    "reasoning": "Overall assessment"
}}
        """
    
    def _build_gap_analysis_prompt(
        self,
        current_skills: List[str],
        target_role: str,
        required_skills: List[str],
    ) -> str:
        """Build detailed prompt for skill gap analysis."""
        return f"""
You are an expert career strategist analyzing skill gaps for career transition.

SITUATION:
- Target Career: {target_role}
- Current Skills: {', '.join(current_skills) if current_skills else 'None specified'}
- Required Skills for Role: {', '.join(required_skills)}

TASK:
1. Identify specific skill gaps (required but not current)
2. Categorize gaps by priority (must-have vs nice-to-have)
3. Estimate learning timeline
4. Provide actionable recommendations

ANALYSIS CRITERIA:
- "High Priority": Critical for day-1 success in role
- "Medium Priority": Important within first 3-6 months
- "Low Priority": Nice-to-have for long-term growth

Return ONLY valid JSON:
{{
    "current_skills": ["Skill1", "Skill2"],
    "required_skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5"],
    "gap_analysis": ["GapSkill1", "GapSkill2", "GapSkill3"],
    "priority_gaps": ["HighPrioritySkill1", "HighPrioritySkill2"],
    "timeline_months": 6,
    "recommendations": [
        "Learn X through Y course",
        "Build Z project",
        "Practice with real data"
    ]
}}
        """
    
    def _build_roadmap_prompt(
        self,
        target_role: str,
        missing_skills: List[str],
        current_experience: str,
    ) -> str:
        """Build detailed prompt for personalized learning roadmap."""
        return f"""
You are an expert learning strategist designing a personalized development roadmap.

CONTEXT:
- Target Role: {target_role}
- Current Experience Level: {current_experience}
- Skills to Acquire: {', '.join(missing_skills) if missing_skills else 'Not specified'}

TASK:
1. Create realistic phased learning roadmap
2. Sequence skills by dependencies and difficulty
3. Include concrete milestones and projects
4. Estimate time per phase realistically
5. Recommend specific resources/courses

REQUIREMENTS:
- Must be achievable in reasonable timeline
- Include hands-on projects to apply learning
- Sequence from foundational to advanced
- Each phase should be 1-3 months

Return ONLY valid JSON:
{{
    "phases": [
        {{
            "phase": 1,
            "title": "Phase Name",
            "duration_months": 2,
            "skills": ["Skill1", "Skill2"],
            "resources": ["Udemy Course X", "Official Documentation"],
            "milestones": ["Build Y project", "Complete Z"]
        }}
    ],
    "total_months": 6,
    "success_criteria": ["Can build production app"],
    "milestones": ["Phase 1 complete", "Build project"],
    "resources": ["Udemy", "Coursera", "YouTube"]
}}
        """

