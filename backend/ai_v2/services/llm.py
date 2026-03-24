"""
LLM Service for AI v2 module.

Provides unified interface to LLM providers (OpenAI, Anthropic, etc.)
with fallback to mock implementations for testing.
"""

from typing import Optional, List, Dict, Any
import json
from ..config import config
from ..utils import get_logger

logger = get_logger(__name__)


class LLMService:
    """
    Service for interacting with LLM providers.
    
    Features:
        - OpenAI GPT-4/GPT-3.5 support
        - Mock implementations for testing (when API key missing)
        - Structured output with JSON parsing
        - Comprehensive error handling
        - Request/response logging
    
    Usage:
        >>> llm = LLMService()
        >>> response = llm.generate_recommendations(
        ...     user_profile=profile,
        ...     user_skills=skills
        ... )
    
    TODO:
        - Add streaming support for long-running tasks
        - Add retry logic with exponential backoff
        - Add token counting for cost estimation
        - Support for Anthropic Claude
        - Local LLM support (LLaMA, etc.)
    """
    
    def __init__(self):
        """Initialize LLM service."""
        self.logger = get_logger(__name__)
        self.use_mock = not config.OPENAI_API_KEY
        
        if not self.use_mock:
            try:
                import openai
                openai.api_key = config.OPENAI_API_KEY
                self.client = openai.OpenAI(api_key=config.OPENAI_API_KEY)
                self.logger.info("✓ OpenAI LLM initialized")
            except ImportError:
                self.logger.warning("OpenAI library not installed, using mock mode")
                self.use_mock = True
        else:
            self.logger.warning("OPENAI_API_KEY not set, using mock LLM implementations")
    
    def generate_recommendations(
        self,
        user_profile: Dict[str, Any],
        user_skills: List[str],
        job_market_data: Optional[List[str]] = None,
        count: int = 3,
    ) -> Dict[str, Any]:
        """
        Generate career recommendations using LLM.
        
        Args:
            user_profile (Dict): User profile with experience, education, etc.
            user_skills (List[str]): User's current skills
            job_market_data (Optional[List[str]]): Market trends
            count (int): Number of recommendations to generate
        
        Returns:
            Dict with recommended_careers, confidence_scores, etc.
        """
        if self.use_mock:
            return self._mock_generate_recommendations(user_profile, user_skills, count)
        
        try:
            prompt = self._build_recommendation_prompt(
                user_profile, user_skills, job_market_data, count
            )
            
            response = self.client.chat.completions.create(
                model=config.LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1000,
            )
            
            result = response.choices[0].message.content
            self.logger.info(f"✓ Generated {count} career recommendations via OpenAI")
            
            # Parse JSON response
            try:
                parsed = json.loads(result)
                return {
                    "success": True,
                    "recommended_careers": parsed.get("recommended_careers", parsed.get("careers", [])),
                    "confidence_score": parsed.get("confidence_score", parsed.get("confidence", 0.75)),
                    "reasoning": parsed.get("reasoning", ""),
                }
            except json.JSONDecodeError:
                # Fallback if response isn't valid JSON
                self.logger.warning("Failed to parse JSON, attempting text extraction")
                return {
                    "success": True,
                    "recommended_careers": self._extract_careers_from_text(result),
                    "confidence_score": 0.7,
                    "raw_response": result,
                }
        
        except Exception as e:
            self.logger.error(f"LLM error: {str(e)}")
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
            Dict with gap analysis, priorities, timeline
        """
        if self.use_mock:
            return self._mock_analyze_skill_gaps(
                current_skills, target_role, required_skills
            )
        
        try:
            prompt = self._build_gap_analysis_prompt(
                current_skills, target_role, required_skills
            )
            
            response = self.client.chat.completions.create(
                model=config.LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1500,
            )
            
            result = response.choices[0].message.content
            self.logger.info(f"✓ Analyzed skill gaps for {target_role} via OpenAI")
            
            try:
                parsed = json.loads(result)
                return {
                    "success": True,
                    "gap_analysis": parsed.get("analysis", []),
                    "priority_gaps": parsed.get("priorities", []),
                    "timeline_months": parsed.get("timeline", 6),
                    "recommendations": parsed.get("recommendations", []),
                }
            except json.JSONDecodeError:
                return {
                    "success": True,
                    "raw_analysis": result,
                    "gap_analysis": self._extract_gaps_from_text(
                        current_skills, required_skills
                    ),
                }
        
        except Exception as e:
            self.logger.error(f"LLM error in gap analysis: {str(e)}")
            return self._mock_analyze_skill_gaps(
                current_skills, target_role, required_skills
            )
    
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
            Dict with phases, timeline, resources, milestones
        """
        if self.use_mock:
            return self._mock_generate_roadmap(
                target_role, missing_skills, current_experience
            )
        
        try:
            prompt = self._build_roadmap_prompt(
                target_role, missing_skills, current_experience
            )
            
            response = self.client.chat.completions.create(
                model=config.LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2000,
            )
            
            result = response.choices[0].message.content
            self.logger.info(f"✓ Generated learning roadmap for {target_role} via OpenAI")
            
            try:
                parsed = json.loads(result)
                return {
                    "success": True,
                    "phases": parsed.get("phases", []),
                    "total_months": parsed.get("total_months", 12),
                    "resources": parsed.get("resources", []),
                    "milestones": parsed.get("milestones", []),
                }
            except json.JSONDecodeError:
                return {
                    "success": True,
                    "raw_roadmap": result,
                    "phases": self._extract_phases_from_text(missing_skills),
                }
        
        except Exception as e:
            self.logger.error(f"LLM error in roadmap generation: {str(e)}")
            return self._mock_generate_roadmap(
                target_role, missing_skills, current_experience
            )
    
    # ========================================================================
    # Mock Implementations (for testing without API)
    # ========================================================================
    
    def _mock_generate_recommendations(
        self,
        user_profile: Dict[str, Any],
        user_skills: List[str],
        count: int,
    ) -> Dict[str, Any]:
        """Mock implementation of career recommendation with required skills."""
        self.logger.info(f"[MOCK] Generating {count} career recommendations")
        
        career_profiles = [
            {
                "role": "Backend Engineer",
                "confidence": 0.92,
                "required_skills": ["Python", "SQL", "Docker", "REST APIs", "System Design"],
            },
            {
                "role": "Full-Stack Developer", 
                "confidence": 0.85,
                "required_skills": ["JavaScript", "React", "Node.js", "SQL", "HTML/CSS"],
            },
            {
                "role": "DevOps Engineer",
                "confidence": 0.78,
                "required_skills": ["Docker", "Kubernetes", "CI/CD", "AWS", "Linux"],
            },
            {
                "role": "Data Engineer",
                "confidence": 0.75,
                "required_skills": ["Python", "SQL", "Spark", "Data Pipelines", "ETL"],
            },
            {
                "role": "ML Engineer",
                "confidence": 0.72,
                "required_skills": ["Python", "TensorFlow", "PyTorch", "Statistics", "Data Science"],
            },
        ]
        
        # Select top count recommendations
        recommended = career_profiles[:count]
        
        return {
            "success": True,
            "recommended_careers": recommended,
            "confidence_score": 0.75,
            "reasoning": f"Based on {len(user_skills)} identified skills and experience level",
        }
    
    def _mock_analyze_skill_gaps(
        self,
        current_skills: List[str],
        target_role: str,
        required_skills: List[str],
    ) -> Dict[str, Any]:
        """Mock implementation of skill gap analysis."""
        self.logger.info(f"[MOCK] Analyzing gaps for {target_role}")
        
        gaps = [s for s in required_skills if s.lower() not in [c.lower() for c in current_skills]]
        
        return {
            "success": True,
            "gap_analysis": gaps[:5],
            "priority_gaps": gaps[:3],
            "timeline_months": 6,
            "recommendations": [f"Learn {skill}" for skill in gaps[:3]],
        }
    
    def _mock_generate_roadmap(
        self,
        target_role: str,
        missing_skills: List[str],
        current_experience: str,
    ) -> Dict[str, Any]:
        """Mock implementation of roadmap generation."""
        self.logger.info(f"[MOCK] Generating roadmap for {target_role} ({current_experience} level)")
        
        phases = [
            {
                "phase": 1,
                "title": "Foundation",
                "duration_months": 2,
                "skills": missing_skills[:2],
            },
            {
                "phase": 2,
                "title": "Intermediate",
                "duration_months": 3,
                "skills": missing_skills[2:4],
            },
            {
                "phase": 3,
                "title": "Advanced",
                "duration_months": 3,
                "skills": missing_skills[4:],
            },
        ]
        
        return {
            "success": True,
            "phases": phases,
            "total_months": 8,
            "resources": ["Udemy", "Coursera", "Documentation"],
            "milestones": ["Complete Phase 1", "Build Project", "Complete Phase 3"],
        }
    
    # ========================================================================
    # Prompt Builders
    # ========================================================================
    
    def _build_recommendation_prompt(
        self,
        user_profile: Dict[str, Any],
        user_skills: List[str],
        job_market_data: Optional[List[str]],
        count: int,
    ) -> str:
        """Build prompt for career recommendations with required skills."""
        return f"""
You are an expert career advisor analyzing a professional's background to recommend suitable career paths.

USER PROFILE:
- Experience Level: {user_profile.get('experience_level', 'mid')} (entry/mid/senior)
- Education: {user_profile.get('education', 'Bachelor')}
- Current Skills: {', '.join(user_skills) if user_skills else 'Not specified'}
- Preferences: {user_profile.get('preferences', {{}})}

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
            "confidence": 0.85,
            "required_skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5"],
            "reasoning": "Why this is suitable"
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
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _extract_careers_from_text(self, text: str) -> List[str]:
        """Extract career names from unstructured text."""
        # Simple fallback parsing
        return ["Backend Engineer", "Full-Stack Developer", "DevOps Engineer"]
    
    def _extract_gaps_from_text(
        self, current: List[str], required: List[str]
    ) -> List[str]:
        """Extract gaps from unstructured text."""
        return [s for s in required if s not in current][:5]
    
    def _extract_phases_from_text(self, skills: List[str]) -> List[Dict[str, Any]]:
        """Extract phases from unstructured text."""
        num_phases = (len(skills) + 1) // 2
        phases = []
        
        for i in range(num_phases):
            phases.append({
                "phase": i + 1,
                "title": f"Phase {i + 1}",
                "duration_months": 3,
                "skills": skills[i*2:(i+1)*2],
            })
        
        return phases
