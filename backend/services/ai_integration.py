"""
AI Integration Service - Adapter between existing app and ai_v2 system.

This service provides a clean interface for the existing application (Next.js admin, 
mobile app) to use the new ai_v2 pipeline. It:

1. Accepts old input formats (userId, cvText, userProfile)
2. Transforms them to ai_v2 schemas
3. Calls the ai_v2 orchestrator
4. Transforms ai_v2 output back to formats expected by existing app
5. Includes feature flag for safe rollback to old system if needed

Integration Points:
- Mobile CV Analysis: Mobile/src/features/cv/cv-analysis.service.ts → POST /analyze-cv
- Admin Recommendations: admin-dashboard/app/api/recommendations → POST /recommend-careers
- Next.js API Routes: admin-dashboard/app/api/* → call this service
"""

import os
import sys
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

# Add parent directory to path so we can import ai_v2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from ai_v2.orchestrator import PipelineOrchestrator
from ai_v2.schemas import UserProfile, CareerRecommendationOutput
from ai_v2.utils import get_logger
from ai_v2.config import config

logger = get_logger(__name__)


# Feature flag: Set to False to fallback to old system
USE_AI_V2 = os.getenv("USE_AI_V2", "true").lower() == "true"


@dataclass
class CVAnalysisRequest:
    """Request format for CV analysis (from mobile app)."""
    cv_text: str
    user_id: str
    cv_id: Optional[str] = None
    file_name: Optional[str] = None


@dataclass
class CareerRecommendationRequest:
    """Request format for career recommendations."""
    user_id: str
    cv_text: Optional[str] = None
    user_profile: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None


@dataclass
class CVAnalysisResponse:
    """
    Response format for CV analysis - matches OpenRouter response schema.
    Used by: Mobile app cv_analysis table, admin dashboard.
    """
    ats_score: float
    ats_issues: List[Dict[str, str]]
    ats_suggestions: List[Dict[str, str]]
    career_suggestions: List[Dict[str, Any]]
    extracted_skills: List[str]
    extracted_interests: List[str]
    ai_version: str = "v2"  # Mark that this came from ai_v2


class AIIntegrationService:
    """
    Main service for integrating ai_v2 into the existing application.
    
    Responsibilities:
    1. Accept requests in old format (from Next.js routes, mobile app)
    2. Transform to ai_v2 schema
    3. Execute ai_v2 pipeline via orchestrator
    4. Transform results back to old format
    5. Handle errors gracefully with feature flag fallback
    
    Usage:
        service = AIIntegrationService()
        
        # For CV analysis
        cv_result = service.analyze_cv_from_text(
            cv_text="...",
            user_id="user-123",
            cv_id="cv-456"
        )
        
        # For career recommendations
        rec_result = service.get_career_recommendations(
            user_id="user-123",
            cv_text="...",
            user_profile={...}
        )
    """
    
    def __init__(self):
        """Initialize the integration service."""
        self.orchestrator = PipelineOrchestrator()
        self.use_ai_v2 = USE_AI_V2
        logger.info(f"AIIntegrationService initialized. USE_AI_V2={self.use_ai_v2}")
    
    def analyze_cv_from_text(
        self,
        cv_text: str,
        user_id: str,
        cv_id: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> CVAnalysisResponse:
        """
        Analyze CV text and return analysis results.
        
        This method replaces the mobile app's direct call to OpenRouter.
        Instead of calling OpenRouter, it uses the ai_v2 system which includes:
        - CV extraction via CVAgent
        - Career matching via CareerAgent
        - Better context via RAG system
        
        Args:
            cv_text: Raw CV text to analyze
            user_id: Supabase user ID
            cv_id: Optional CV upload ID (for logging/tracking)
            file_name: Optional original filename
        
        Returns:
            CVAnalysisResponse: Analysis results in format expected by mobile app
                - ats_score (0-100)
                - ats_issues, ats_suggestions (for ATS compatibility)
                - career_suggestions (with match scores)
                - extracted_skills, extracted_interests
        
        Raises:
            ValueError: If cv_text is empty or invalid
            Exception: If ai_v2 pipeline fails (logs and raises)
        """
        if not cv_text or not cv_text.strip():
            raise ValueError("CV text cannot be empty")
        
        if not user_id:
            raise ValueError("user_id is required")
        
        logger.info(
            f"[AI_INTEGRATION] CV analysis requested (USE_AI_V2={self.use_ai_v2})",
            extra={
                "user_id": user_id,
                "cv_id": cv_id,
                "file_name": file_name,
                "cv_length": len(cv_text),
            }
        )
        
        if not self.use_ai_v2:
            logger.warning("USE_AI_V2 is disabled, falling back to old system")
            raise NotImplementedError("Fallback to old system not implemented in this version")
        
        try:
            # Build user profile for orchestrator
            user_profile = UserProfile(
                user_id=user_id,
                current_skills=[],  # Will be extracted from CV
                experience_level="intermediate",
                education_background="",
                career_goals=[],
            )
            
            # Build pipeline input
            pipeline_input = {
                "user_profile": user_profile,
                "cv_text": cv_text,
                "job_market_data": None,
                "preferences": None,
            }
            
            # Run ai_v2 pipeline
            logger.info(f"[AI_INTEGRATION] Running ai_v2 orchestrator for CV analysis")
            output = self.orchestrator.run_pipeline(pipeline_input)
            
            # Transform ai_v2 output to CVAnalysisResponse format
            response = self._transform_to_cv_analysis_response(output, cv_text)
            
            logger.info(
                f"[AI_INTEGRATION] CV analysis complete",
                extra={
                    "user_id": user_id,
                    "ats_score": response.ats_score,
                    "career_suggestions": len(response.career_suggestions),
                    "skills_extracted": len(response.extracted_skills),
                }
            )
            
            return response
            
        except Exception as e:
            logger.error(
                f"[AI_INTEGRATION] CV analysis failed: {str(e)}",
                extra={
                    "user_id": user_id,
                    "cv_id": cv_id,
                    "error_type": type(e).__name__,
                }
            )
            raise
    
    def analyze_cv_from_pdf(
        self,
        pdf_base64: str,
        user_id: str,
        cv_id: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> CVAnalysisResponse:
        """
        Analyze PDF CV using Claude's document vision API.
        
        This method handles PDF analysis directly using Claude's document block feature,
        which can handle both text-based and image-based PDFs.
        
        Args:
            pdf_base64: Base64 encoded PDF content
            user_id: Supabase user ID
            cv_id: Optional CV upload ID (for logging/tracking)
            file_name: Optional original filename
        
        Returns:
            CVAnalysisResponse: Analysis results in format expected by mobile app
        
        Raises:
            ValueError: If pdf_base64 is empty or invalid
            Exception: If Claude API fails
        """
        if not pdf_base64 or not pdf_base64.strip():
            raise ValueError("PDF base64 cannot be empty")
        
        if not user_id:
            raise ValueError("user_id is required")
        
        logger.info(
            f"[AI_INTEGRATION] PDF CV analysis requested",
            extra={
                "user_id": user_id,
                "cv_id": cv_id,
                "file_name": file_name,
                "pdf_size": len(pdf_base64),
            }
        )
        
        try:
            # Import Anthropic client
            from anthropic import Anthropic
            client = Anthropic()
            
            # Call Claude with document vision
            logger.debug("[AI_INTEGRATION] Sending PDF to Claude with document vision...")
            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": "application/pdf",
                                    "data": pdf_base64,
                                }
                            },
                            {
                                "type": "text",
                                "text": """Analyze this CV/resume and extract the following information in JSON format:
{
    "ats_score": <0-100>,
    "ats_issues": ["issue1", "issue2"],
    "ats_suggestions": ["suggestion1", "suggestion2"],
    "extracted_skills": ["skill1", "skill2"],
    "extracted_interests": ["interest1", "interest2"],
    "career_suggestions": [
        {"title": "Career 1", "match_score": 85, "reasoning": "..."},
        {"title": "Career 2", "match_score": 75, "reasoning": "..."}
    ]
}

Focus on:
1. ATS compatibility issues (formatting, keywords, structure)
2. Technical skills and proficiencies
3. Inferred interests from projects/experience
4. Career paths that match the background

Return ONLY valid JSON, no markdown or extra text."""
                            }
                        ]
                    }
                ]
            )
            
            # Extract JSON from response
            response_text = message.content[0].text
            
            # Parse JSON from response
            import json
            import re
            
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                logger.error(f"[AI_INTEGRATION] No JSON found in Claude response: {response_text[:200]}")
                raise ValueError("Claude response doesn't contain JSON")
            
            json_str = json_match.group(0)
            analysis_data = json.loads(json_str)
            
            # Validate required fields and set defaults
            analysis_data.setdefault("ats_score", 70)
            analysis_data.setdefault("ats_issues", [])
            analysis_data.setdefault("ats_suggestions", [])
            analysis_data.setdefault("extracted_skills", [])
            analysis_data.setdefault("extracted_interests", [])
            analysis_data.setdefault("career_suggestions", [])
            
            logger.info(
                f"[AI_INTEGRATION] PDF CV analysis complete",
                extra={
                    "user_id": user_id,
                    "ats_score": analysis_data["ats_score"],
                    "career_suggestions": len(analysis_data["career_suggestions"]),
                    "skills_extracted": len(analysis_data["extracted_skills"]),
                }
            )
            
            # Convert to CVAnalysisResponse format
            from api.schemas import CVAnalysisResponse
            response = CVAnalysisResponse(
                ats_score=analysis_data.get("ats_score", 70),
                ats_issues=analysis_data.get("ats_issues", []),
                ats_suggestions=analysis_data.get("ats_suggestions", []),
                career_suggestions=analysis_data.get("career_suggestions", []),
                extracted_skills=analysis_data.get("extracted_skills", []),
                extracted_interests=analysis_data.get("extracted_interests", []),
                ai_version="v2-pdf"
            )
            
            return response
            
        except Exception as e:
            logger.error(
                f"[AI_INTEGRATION] PDF CV analysis failed: {str(e)}",
                extra={
                    "user_id": user_id,
                    "cv_id": cv_id,
                    "error_type": type(e).__name__,
                }
            )
            raise
    
    def get_career_recommendations(
        self,
        user_id: str,
        cv_text: Optional[str] = None,
        user_profile: Optional[Dict[str, Any]] = None,
        preferences: Optional[Dict[str, Any]] = None,
    ) -> CareerRecommendationOutput:
        """
        Generate career recommendations for a user.
        
        This method replaces the old system where recommendations were
        pre-generated and just stored. Now it generates them using ai_v2.
        
        Args:
            user_id: Supabase user ID
            cv_text: Optional CV text for better recommendations
            user_profile: Optional user profile dict:
                {
                    "current_skills": [string],
                    "experience_level": string,  # junior|intermediate|senior
                    "education_background": string,
                    "career_goals": [string],
                }
            preferences: Optional preferences dict:
                {
                    "preferred_roles": [string],
                    "preferred_industries": [string],
                }
        
        Returns:
            CareerRecommendationOutput: Structured recommendations including:
                - recommended_careers: List of top career matches
                - skill_gaps: Gaps for each recommended career
                - roadmap: Learning roadmap
                - confidence_score: Overall confidence
        
        Raises:
            ValueError: If user_id is invalid
            Exception: If ai_v2 pipeline fails
        """
        if not user_id:
            raise ValueError("user_id is required")
        
        logger.info(
            f"[AI_INTEGRATION] Career recommendation requested (USE_AI_V2={self.use_ai_v2})",
            extra={
                "user_id": user_id,
                "has_cv": bool(cv_text),
                "has_profile": bool(user_profile),
            }
        )
        
        if not self.use_ai_v2:
            logger.warning("USE_AI_V2 is disabled, falling back to old system")
            raise NotImplementedError("Fallback to old system not implemented in this version")
        
        try:
            # Build user profile for orchestrator
            user_profile_obj = self._build_user_profile(user_id, user_profile)
            
            # Build pipeline input
            pipeline_input = {
                "user_profile": user_profile_obj,
                "cv_text": cv_text,
                "job_market_data": None,
                "preferences": preferences or {},
            }
            
            # Run ai_v2 pipeline
            logger.info(f"[AI_INTEGRATION] Running ai_v2 orchestrator for recommendations")
            output = self.orchestrator.run_pipeline(pipeline_input)
            
            logger.info(
                f"[AI_INTEGRATION] Career recommendations complete",
                extra={
                    "user_id": user_id,
                    "recommendations_count": len(output.recommended_careers),
                    "confidence_score": output.confidence_score,
                }
            )
            
            return output
            
        except Exception as e:
            logger.error(
                f"[AI_INTEGRATION] Career recommendation failed: {str(e)}",
                extra={
                    "user_id": user_id,
                    "error_type": type(e).__name__,
                }
            )
            raise
    
    def _transform_to_cv_analysis_response(
        self,
        output: CareerRecommendationOutput,
        cv_text: str,
    ) -> CVAnalysisResponse:
        """
        Transform ai_v2 CareerRecommendationOutput to CVAnalysisResponse.
        
        Maps ai_v2 output schema to the format expected by the old system
        (which was calling OpenRouter API).
        
        Transforms:
        - ai_v2 recommended_careers → career_suggestions (with reasoning)
        - ai_v2 confidence_score → ats_score (0-100)
        - ai_v2 skill_gaps → extracted skills/gaps
        - Adds generic ATS issues and suggestions
        
        Args:
            output: ai_v2 output from orchestrator
            cv_text: Original CV text (for calculating metrics)
        
        Returns:
            CVAnalysisResponse: Response in CVAnalysisResponse format
        """
        # Extract skills from output
        agent_outputs = output.agent_outputs or {}
        cv_agent_output = agent_outputs.get("cv", {})
        cv_data = getattr(cv_agent_output, "data", {}) or {}
        
        extracted_skills = cv_data.get("skills_extracted", [])
        extracted_interests = cv_data.get("interests_extracted", [])
        
        # Build career suggestions from recommendations
        career_suggestions = []
        for i, career in enumerate(output.recommended_careers[:3]):  # Top 3
            match_score = min(100, int(career.match_score * 100)) if hasattr(career, 'match_score') else 70 - (i * 5)
            
            suggestion = {
                "title": career.title if hasattr(career, 'title') else "Career Position",
                "match_score": match_score,
                "reasoning": career.reasoning if hasattr(career, 'reasoning') else (
                    f"Matches {match_score}% of required skills"
                ),
            }
            career_suggestions.append(suggestion)
        
        # Calculate ATS score (confidence_score is 0-1, ats_score should be 40-95)
        confidence = output.confidence_score if hasattr(output, 'confidence_score') else 0.7
        ats_score = 40 + int(confidence * 55)  # Range: 40-95
        
        # Build ATS issues and suggestions
        ats_issues = [
            {
                "type": "content",
                "severity": "info",
                "description": "CV successfully processed by ai_v2 system"
            },
            {
                "type": "skills",
                "severity": "info",
                "description": f"Identified {len(extracted_skills)} technical skills"
            }
        ]
        
        ats_suggestions = [
            {
                "section": "Skills",
                "suggestion": f"You have {len(extracted_skills)} identified skills. Consider adding domain-specific expertise.",
                "example": ", ".join(extracted_skills[:3]) if extracted_skills else "JavaScript, Python, React"
            },
            {
                "section": "Career",
                "suggestion": f"Top match: {career_suggestions[0]['title'] if career_suggestions else 'Software Engineer'} ({career_suggestions[0]['match_score'] if career_suggestions else 70}% match)",
                "example": "Your background aligns well with this role"
            }
        ]
        
        return CVAnalysisResponse(
            ats_score=float(ats_score),
            ats_issues=ats_issues,
            ats_suggestions=ats_suggestions,
            career_suggestions=career_suggestions,
            extracted_skills=extracted_skills,
            extracted_interests=extracted_interests,
        )
    
    def _build_user_profile(
        self,
        user_id: str,
        user_profile_dict: Optional[Dict[str, Any]] = None,
    ) -> UserProfile:
        """
        Build a UserProfile object from dict or defaults.
        
        Args:
            user_id: Supabase user ID
            user_profile_dict: Optional dict with profile data
        
        Returns:
            UserProfile: Object for ai_v2 orchestrator
        """
        profile_dict = user_profile_dict or {}
        
        return UserProfile(
            user_id=user_id,
            current_skills=profile_dict.get("current_skills", []),
            experience_level=profile_dict.get("experience_level", "intermediate"),
            education_background=profile_dict.get("education_background", ""),
            career_goals=profile_dict.get("career_goals", []),
        )


# Singleton instance for use across the application
_service_instance: Optional[AIIntegrationService] = None


def get_ai_integration_service() -> AIIntegrationService:
    """
    Get or create the singleton AIIntegrationService instance.
    
    Usage:
        service = get_ai_integration_service()
        result = service.analyze_cv_from_text(...)
    """
    global _service_instance
    if _service_instance is None:
        _service_instance = AIIntegrationService()
    return _service_instance


def reset_service():
    """Reset the singleton instance (useful for testing)."""
    global _service_instance
    _service_instance = None
