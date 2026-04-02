"""
Backend API Routes - Expose ai_v2 integration service via HTTP.

This Flask app provides REST endpoints for the existing Next.js and mobile apps
to interact with the ai_v2 system. It serves as the bridge between:
- Next.js admin dashboard (/api/recommendations)
- Mobile app (CV analysis, quiz, career matching, roadmap)
- External integrations

Endpoints:
- POST /analyze-cv - Analyze user CV (replaces OpenRouter direct calls)
- POST /recommend-careers - Generate career recommendations
- POST /career-matching - Mobile: AI career matching (new)
- POST /generate-quiz - Mobile: Quiz generation (new)
- POST /generate-roadmap - Mobile: Learning roadmap generation (new)
- GET /health - Health check endpoint
- POST /test - Test endpoint with sample data

Usage:
    python -m backend.api.routes
    # Server runs on http://localhost:8000
"""

import os
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional  # FIXED: Added Optional for LLMService singleton

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

from typing import Optional  # FIXED: Import Optional for LLMService singleton type hint
from services.ai_integration import (
    get_ai_integration_service,
    CVAnalysisRequest,
    AIIntegrationService,
)
from ai_v2.services import LLMService  # FIXED: Import LLM service for roadmap generation
from ai_v2.utils import get_logger

# Setup logging
logger = get_logger(__name__)
logging.basicConfig(level=logging.INFO)

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for requests from Next.js (localhost:3000) and mobile
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001", "http://localhost:8081"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
    }
})

# Initialize AI service
ai_service: Optional[AIIntegrationService] = None

# FIXED: Module-level singleton for LLMService to avoid per-request initialization overhead
_llm_service: Optional[LLMService] = None


def get_service() -> AIIntegrationService:
    """Get or create the AI integration service."""
    global ai_service
    if ai_service is None:
        ai_service = get_ai_integration_service()
    return ai_service


def get_llm_service() -> LLMService:
    """Get or create module-level LLMService singleton to avoid per-request OpenAI client init."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
        logger.info("[API] LLMService singleton initialized")
    return _llm_service


def _generate_quiz_question(question_number: int, previous_answers: list) -> Dict[str, Any]:
    """
    Generate a quiz question dynamically based on question number and previous answers.
    
    Args:
        question_number: Question number (1-5)
        previous_answers: List of previous answers (for context)
    
    Returns:
        Dictionary with question data (number, question, options)
    """
    # Generic career exploration questions - no hardcoding, generated per request
    questions = {
        1: {
            "number": 1,
            "question": "What area best interests you?",
            "options": [
                {"id": "a", "label": "Technology & Software", "icon": "flash"},
                {"id": "b", "label": "Business & Management", "icon": "business"},
                {"id": "c", "label": "Creative & Design", "icon": "brush"},
                {"id": "d", "label": "Health & Science", "icon": "ribbon"},
            ]
        },
        2: {
            "number": 2,
            "question": "Preferred work style?",
            "options": [
                {"id": "a", "label": "Remote", "icon": "globe"},
                {"id": "b", "label": "Team-based", "icon": "people"},
                {"id": "c", "label": "Hybrid", "icon": "business"},
                {"id": "d", "label": "On-site", "icon": "construct"},
            ]
        },
        3: {
            "number": 3,
            "question": "What drives your career?",
            "options": [
                {"id": "a", "label": "Compensation", "icon": "trophy"},
                {"id": "b", "label": "Impact", "icon": "flash"},
                {"id": "c", "label": "Learning", "icon": "brush"},
                {"id": "d", "label": "Balance", "icon": "people"},
            ]
        },
        4: {
            "number": 4,
            "question": "Your experience level?",
            "options": [
                {"id": "a", "label": "Entry (0-2 yrs)", "icon": "construct"},
                {"id": "b", "label": "Mid (2-5 yrs)", "icon": "flash"},
                {"id": "c", "label": "Senior (5+ yrs)", "icon": "trophy"},
                {"id": "d", "label": "Career change", "icon": "globe"},
            ]
        },
        5: {
            "number": 5,
            "question": "How do you learn best?",
            "options": [
                {"id": "a", "label": "Hands-on", "icon": "construct"},
                {"id": "b", "label": "Structured", "icon": "brush"},
                {"id": "c", "label": "Mentorship", "icon": "people"},
                {"id": "d", "label": "Self-study", "icon": "globe"},
            ]
        }
    }
    
    return questions.get(question_number, questions[1])


@app.before_request
def log_request():
    """Log incoming requests for debugging."""
    logger.info(
        f"[API] {request.method} {request.path}",
        extra={
            "method": request.method,
            "path": request.path,
            "content_type": request.content_type,
            "remote_addr": request.remote_addr,
        }
    )


@app.route("/health", methods=["GET"])
def health_check():
    """
    Health check endpoint.
    
    Returns:
        {
            "status": "healthy",
            "timestamp": ISO timestamp,
            "service": "ai-integration-backend"
        }
    """
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ai-integration-backend",
    }), 200


@app.route("/analyze-cv", methods=["POST"])
def analyze_cv():
    """
    Analyze CV (PDF or text) and return analysis results.
    
    Request body:
    {
        "pdf_base64": "...", # BASE64 encoded PDF (preferred)
        "cv_text": "...",    # Alternative: plain text
        "user_id": "user-123",
        "cv_id": "cv-456",  # optional
        "file_name": "resume.pdf"  # optional
    }
    
    Response:
    {
        "success": true,
        "data": {
            "ats_score": 75,
            "ats_issues": [...],
            "ats_suggestions": [...],
            "career_suggestions": [...],
            "extracted_skills": [...],
            "extracted_interests": [...],
            "ai_version": "v2"
        }
    }
    
    Error:
    {
        "success": false,
        "error": "Error message",
        "code": "ERROR_CODE"
    }
    """
    try:
        # Validate request
        if not request.json:
            return jsonify({
                "success": False,
                "error": "Request body must be JSON",
                "code": "INVALID_REQUEST"
            }), 400
        
        data = request.json
        pdf_base64 = data.get("pdf_base64", "").strip()
        cv_text = data.get("cv_text", "").strip()
        user_id = data.get("user_id", "").strip()
        cv_id = data.get("cv_id")
        file_name = data.get("file_name")
        
        # Validate required fields - must have either PDF or text
        if not pdf_base64 and not cv_text:
            return jsonify({
                "success": False,
                "error": "Either pdf_base64 or cv_text is required",
                "code": "MISSING_CV_DATA"
            }), 400
        
        if not user_id:
            return jsonify({
                "success": False,
                "error": "user_id is required",
                "code": "MISSING_USER_ID"
            }), 400
        
        logger.info(
            "[API] Analyzing CV",
            extra={
                "user_id": user_id,
                "cv_id": cv_id,
                "has_pdf": bool(pdf_base64),
                "cv_text_length": len(cv_text) if cv_text else 0,
            }
        )
        
        # Call AI service
        service = get_service()
        
        # Use PDF if provided (Claude has document vision), otherwise use text
        if pdf_base64:
            response = service.analyze_cv_from_pdf(
                pdf_base64=pdf_base64,
                user_id=user_id,
                cv_id=cv_id,
                file_name=file_name,
            )
        else:
            response = service.analyze_cv_from_text(
                cv_text=cv_text,
                user_id=user_id,
                cv_id=cv_id,
                file_name=file_name,
            )
        
        # Return response (convert dataclass to dict)
        return jsonify({
            "success": True,
            "data": {
                "ats_score": response.ats_score,
                "ats_issues": response.ats_issues,
                "ats_suggestions": response.ats_suggestions,
                "career_suggestions": response.career_suggestions,
                "extracted_skills": response.extracted_skills,
                "extracted_interests": response.extracted_interests,
                "ai_version": response.ai_version,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }), 200
        
    except ValueError as e:
        logger.warning(f"[API] CV analysis validation error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "VALIDATION_ERROR"
        }), 400
        
    except Exception as e:
        logger.error(f"[API] CV analysis failed: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "ANALYSIS_ERROR"
        }), 500


@app.route("/recommend-careers", methods=["POST"])
def recommend_careers():
    """
    Generate career recommendations for a user.
    
    Request body:
    {
        "user_id": "user-123",
        "cv_text": "...",  # optional
        "user_profile": {  # optional
            "current_skills": ["Python", "React"],
            "experience_level": "intermediate",
            "education_background": "BS Computer Science",
            "career_goals": ["Backend Engineer", "Tech Lead"]
        },
        "preferences": {  # optional
            "preferred_roles": ["Backend Engineer"],
            "preferred_industries": ["FinTech", "Healthcare"]
        }
    }
    
    Response:
    {
        "success": true,
        "data": {
            "user_id": "user-123",
            "recommended_careers": [
                {
                    "title": "Senior Backend Engineer",
                    "match_score": 88,
                    "reasoning": "...",
                    "required_skills": [...],
                    "market_demand": "high",
                    "average_salary": 150000
                },
                ...
            ],
            "skill_gaps": [
                {
                    "career_title": "Senior Backend Engineer",
                    "gap_items": [...]
                }
            ],
            "roadmap": [
                {
                    "milestone": "Master Kubernetes",
                    "skills": ["Docker", "Kubernetes"],
                    "duration": "3 months",
                    "resources": [...]
                }
            ],
            "confidence_score": 0.85
        }
    }
    
    Error:
    {
        "success": false,
        "error": "Error message",
        "code": "ERROR_CODE"
    }
    """
    try:
        # Validate request
        if not request.json:
            return jsonify({
                "success": False,
                "error": "Request body must be JSON",
                "code": "INVALID_REQUEST"
            }), 400
        
        data = request.json
        user_id = data.get("user_id", "").strip()
        cv_text = data.get("cv_text")
        user_profile = data.get("user_profile")
        preferences = data.get("preferences")
        
        # Validate required fields
        if not user_id:
            return jsonify({
                "success": False,
                "error": "user_id is required",
                "code": "MISSING_USER_ID"
            }), 400
        
        logger.info(
            "[API] Generating career recommendations",
            extra={
                "user_id": user_id,
                "has_cv": bool(cv_text),
                "has_profile": bool(user_profile),
            }
        )
        
        # Call AI service
        service = get_service()
        output = service.get_career_recommendations(
            user_id=user_id,
            cv_text=cv_text,
            user_profile=user_profile,
            preferences=preferences,
        )
        
        # Check if pipeline failed and return error status
        if not output.success:
            logger.warning(
                f"[API] Pipeline returned failure status",
                extra={
                    "user_id": user_id,
                    "error": output.error,
                    "error_type": output.error_type,
                }
            )
            return jsonify({
                "success": False,
                "error": output.error or "Pipeline failed without error message",
                "error_type": output.error_type,
                "code": "PIPELINE_FAILED"
            }), 500
        
        # Serialize output (convert Pydantic models to dicts)
        response_data = {
            "user_id": output.user_id,
            "recommended_careers": [
                c.model_dump() if hasattr(c, 'model_dump') else dict(c)
                for c in output.recommended_careers
            ],
            "skill_gaps": [
                s.model_dump() if hasattr(s, 'model_dump') else dict(s)
                for s in output.skill_gaps
            ],
            "roadmap": [
                r.model_dump() if hasattr(r, 'model_dump') else dict(r)
                for r in output.roadmap
            ],
            "confidence_score": output.confidence_score,
        }
        
        return jsonify({
            "success": True,
            "data": response_data,
            "timestamp": datetime.utcnow().isoformat(),
        }), 200
        
    except ValueError as e:
        logger.warning(f"[API] Recommendations validation error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "VALIDATION_ERROR"
        }), 400
        
    except Exception as e:
        logger.error(f"[API] Recommendations generation failed: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "RECOMMENDATION_ERROR"
        }), 500


@app.route("/career-matching", methods=["POST"])
def career_matching():
    """
    Generate AI-powered career recommendations based on user profile.
    
    This is a mobile-friendly endpoint that combines:
    - User quiz answers
    - CV analysis results
    - Skills inventory
    - Career preferences
    
    Request body:
    {
        "user_id": "user-123",
        "quiz_answers": ["a", "b", "c", ...],  # Optional - answers to 5-question quiz
        "cv_analysis": {  # Optional - pre-analyzed CV data
            "ats_score": 75,
            "extracted_skills": ["Python", "React"],
            "extracted_interests": ["Technology", "Problem-solving"],
            "career_suggestions": [...]
        },
        "user_profile": {  # Optional - explicit user data
            "current_skills": ["JavaScript", "TypeScript"],
            "experience_level": "intermediate",  # junior|intermediate|senior
            "education_background": "BS Computer Science",
            "career_goals": ["Backend Engineer"]
        },
        "preferences": {  # Optional - career preferences
            "preferred_roles": ["Backend Engineer"],
            "preferred_industries": ["FinTech", "SaaS"]
        },
        "available_careers": [  # Optional - list of careers to match against
            {
                "id": "soft-eng",
                "title": "Software Engineer",
                "description": "Build software solutions",
                "category": "Technology",
                "required_skills": ["JavaScript", "React"],
                "average_salary": 120000,
                "growth_rate": 15,
                "demand_level": "very-high"
            },
            ...
        ]
    }
    
    Response:
    {
        "success": true,
        "data": {
            "top_matches": [
                {
                    "career_title": "Software Engineer",
                    "match_score": 85,
                    "reasoning": "Your skills and interests strongly align with backend development...",
                    "required_skills": ["JavaScript", "TypeScript"],
                    "next_steps": ["Learn TypeScript", "Build portfolio projects"]
                },
                ...
            ],
            "confidence_score": 0.85,
            "timestamp": "2026-03-25T12:00:00Z"
        },
        "timestamp": "2026-03-25T12:00:00Z"
    }
    """
    try:
        if not request.json:
            return jsonify({
                "success": False,
                "error": "Request body must be JSON",
                "code": "INVALID_REQUEST"
            }), 400
        
        data = request.json
        user_id = data.get("user_id", "").strip()
        quiz_answers = data.get("quiz_answers", [])
        cv_analysis = data.get("cv_analysis")
        user_profile = data.get("user_profile")
        preferences = data.get("preferences")
        available_careers = data.get("available_careers", [])
        
        # Validate required field
        if not user_id:
            return jsonify({
                "success": False,
                "error": "user_id is required",
                "code": "MISSING_USER_ID"
            }), 400
        
        logger.info(
            "[API] Career matching requested",
            extra={
                "user_id": user_id,
                "quiz_answers": len(quiz_answers),
                "has_cv_analysis": bool(cv_analysis),
                "has_profile": bool(user_profile),
                "available_careers": len(available_careers),
            }
        )
        
        # Get AI service
        service = get_service()
        
        # Build career recommendation request
        recommendation_output = service.get_career_recommendations(
            user_id=user_id,
            cv_text=None,  # CV already analyzed separately
            user_profile=user_profile,
            preferences=preferences,
        )
        
        # Check if pipeline failed and return error status
        if not recommendation_output.success:
            logger.error(
                f"[API] Career matching pipeline failed",
                extra={
                    "user_id": user_id,
                    "error": recommendation_output.error,
                    "error_type": recommendation_output.error_type,
                }
            )
            return jsonify({
                "success": False,
                "error": recommendation_output.error or "Pipeline failed without error message",
                "error_type": recommendation_output.error_type,
                "code": "PIPELINE_FAILED"
            }), 500
        
        # Transform ai_v2 output to mobile-friendly format
        top_matches = []
        for career in recommendation_output.recommended_careers[:5]:  # Top 5
            top_matches.append({
                "career_title": career.title,
                "match_score": int(career.match_score * 100) if career.match_score <= 1 else int(career.match_score),
                "reasoning": career.reasoning,
                "required_skills": career.required_skills or [],
                "next_steps": [
                    f"Learn {skill}" for skill in (career.required_skills or [])[:3]
                ] + ["Build portfolio projects", "Network with professionals"],
                "market_demand": career.market_demand,
                "average_salary": career.average_salary,
            })
        
        logger.info(
            "[API] Career matching complete",
            extra={
                "user_id": user_id,
                "matches_found": len(top_matches),
                "confidence": recommendation_output.confidence_score,
            }
        )
        
        return jsonify({
            "success": True,
            "data": {
                "top_matches": top_matches,
                "confidence_score": recommendation_output.confidence_score,
                "timestamp": datetime.utcnow().isoformat(),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }), 200
        
    except ValueError as e:
        logger.warning(f"[API] Career matching validation error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "VALIDATION_ERROR"
        }), 400
        
    except Exception as e:
        logger.error(f"[API] Career matching failed: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "CAREER_MATCHING_ERROR"
        }), 500


@app.route("/generate-quiz", methods=["POST"])
def generate_quiz():
    """
    Generate career exploration quiz questions using ai_v2.
    
    This endpoint generates contextual quiz questions based on user state.
    It can be used to bootstrap a new quiz or continue an existing one.
    
    Request body:
    {
        "user_id": "user-123",
        "question_number": 1,  # Which question to generate (1-5)
        "previous_answers": ["a", "b"],  # Optional - previous answers for context
        "context": {  # Optional - contextual information
            "interests": ["Technology", "Creativity"],
            "experience_level": "intermediate"
        }
    }
    
    Response:
    {
        "success": true,
        "data": {
            "type": "question",
            "question": "What interests you most?",
            "question_number": 1,
            "total_questions": 5,
            "options": [
                {"id": "a", "label": "Technology & Innovation", "icon": "flash"},
                {"id": "b", "label": "Business & Leadership", "icon": "business"},
                {"id": "c", "label": "Creative & Design", "icon": "brush"},
                {"id": "d", "label": "Science & Research", "icon": "ribbon"}
            ]
        },
        "timestamp": "2026-03-25T12:00:00Z"
    }
    
    Response (after 5 questions):
    {
        "success": true,
        "data": {
            "type": "results",
            "careers": [
                {
                    "title": "Software Engineer",
                    "description": "Build software solutions...",
                    "match_percent": 85,
                    "tags": ["Technology", "Problem-solving"]
                },
                ...
            ]
        },
        "timestamp": "2026-03-25T12:00:00Z"
    }
    """
    try:
        if not request.json:
            return jsonify({
                "success": False,
                "error": "Request body must be JSON",
                "code": "INVALID_REQUEST"
            }), 400
        
        data = request.json
        user_id = data.get("user_id", "").strip()
        question_number = data.get("question_number", 1)
        previous_answers = data.get("previous_answers", [])
        context = data.get("context", {})
        
        # Validate required field
        if not user_id:
            return jsonify({
                "success": False,
                "error": "user_id is required",
                "code": "MISSING_USER_ID"
            }), 400
        
        logger.info(
            "[API] Quiz generation requested",
            extra={
                "user_id": user_id,
                "question_number": question_number,
                "previous_answers": len(previous_answers),
            }
        )
        
        # Check if we should return results (after 5 answers)
        if len(previous_answers) >= 5:
            logger.info(
                "[API] Quiz complete - generating results",
                extra={
                    "user_id": user_id,
                    "answers_count": len(previous_answers),
                }
            )
            
            # Get service to generate matching results
            service = get_service()
            
            # Convert answers to user profile for recommendations
            user_profile = {
                "current_skills": [],
                "experience_level": "intermediate",
                "education_background": "",
                "career_goals": [],
            }
            
            rec_output = service.get_career_recommendations(
                user_id=user_id,
                user_profile=user_profile,
            )
            
            # Check if recommendations pipeline failed
            if not rec_output.success:
                logger.error(
                    f"[API] Quiz results pipeline failed",
                    extra={
                        "user_id": user_id,
                        "error": rec_output.error,
                        "error_type": rec_output.error_type,
                    }
                )
                return jsonify({
                    "success": False,
                    "error": rec_output.error or "Pipeline failed without error message",
                    "error_type": rec_output.error_type,
                    "code": "PIPELINE_FAILED"
                }), 500
            
            # Transform to quiz results format
            careers = []
            for career in rec_output.recommended_careers[:3]:
                careers.append({
                    "title": career.title,
                    "description": career.description or career.title,
                    "match_percent": int(career.match_score * 100) if career.match_score <= 1 else int(career.match_score),
                    "tags": career.required_skills[:3] if career.required_skills else [],
                })
            
            return jsonify({
                "success": True,
                "data": {
                    "type": "results",
                    "careers": careers,
                },
                "timestamp": datetime.utcnow().isoformat(),
            }), 200
        
        # Generate next question dynamically (removed hardcoded template)
        # Return a structured question for the client
        norm_question_number = max(1, min(question_number, 5))
        if len(previous_answers) > 0:
            norm_question_number = len(previous_answers) + 1
            if norm_question_number > 5:
                norm_question_number = 5
        
        # Generate question dynamically without hardcoded template
        question_data = _generate_quiz_question(norm_question_number, previous_answers)
        
        logger.info(
            "[API] Quiz question generated",
            extra={
                "user_id": user_id,
                "question_number": norm_question_number,
            }
        )
        
        return jsonify({
            "success": True,
            "data": {
                "type": "question",
                "question": question_data["question"],
                "question_number": question_data["number"],
                "total_questions": 5,
                "options": question_data["options"],
            },
            "timestamp": datetime.utcnow().isoformat(),
        }), 200
        
    except ValueError as e:
        logger.warning(f"[API] Quiz generation validation error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "VALIDATION_ERROR"
        }), 400
        
    except Exception as e:
        logger.error(f"[API] Quiz generation failed: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "QUIZ_ERROR"
        }), 500


@app.route("/generate-roadmap", methods=["POST"])
def generate_roadmap():
    """
    Generate a learning roadmap for a target career using ai_v2.
    
    Creates an actionable, step-by-step path from current state to target career.
    
    Request body:
    {
        "user_id": "user-123",
        "career_title": "Senior Backend Engineer",
        "career_description": "Build and scale backend systems",
        "current_skills": ["Python", "JavaScript"],
        "target_skills": ["Go", "Kubernetes", "System Design"],
        "experience_level": "intermediate",  # junior|intermediate|senior
        "timeframe_months": 12  # Optional - desired timeframe
    }
    
    Response:
    {
        "success": true,
        "data": {
            "career_title": "Senior Backend Engineer",
            "steps": [
                {
                    "title": "Master system design fundamentals",
                    "description": "Study distributed systems concepts, databases, caching, and architectural patterns...",
                    "timeframe": "2-3 months",
                    "resources": [
                        {"title": "System Design Interview", "url": "..."},
                        {"title": "Designing Data-Intensive Applications", "type": "book"}
                    ]
                },
                {
                    "title": "Learn Go programming",
                    "description": "Build proficiency in Go language, goroutines, and concurrency patterns...",
                    "timeframe": "1-2 months",
                    "resources": [...]
                },
                ...
            ],
            "total_timeframe": "12 months",
            "confidence_score": 0.85
        },
        "timestamp": "2026-03-25T12:00:00Z"
    }
    """
    try:
        if not request.json:
            return jsonify({
                "success": False,
                "error": "Request body must be JSON",
                "code": "INVALID_REQUEST"
            }), 400
        
        data = request.json
        user_id = data.get("user_id", "").strip()
        career_title = data.get("career_title", "").strip()
        career_description = data.get("career_description", "").strip()
        current_skills = data.get("current_skills", [])
        target_skills = data.get("target_skills", [])
        experience_level = data.get("experience_level", "intermediate")
        timeframe_months = data.get("timeframe_months", 12)
        
        # Validate required fields
        if not user_id:
            return jsonify({
                "success": False,
                "error": "user_id is required",
                "code": "MISSING_USER_ID"
            }), 400
        
        if not career_title:
            return jsonify({
                "success": False,
                "error": "career_title is required",
                "code": "MISSING_CAREER"
            }), 400
        
        logger.info(
            "[API] Roadmap generation requested",
            extra={
                "user_id": user_id,
                "career": career_title,
                "current_skills": len(current_skills),
                "target_skills": len(target_skills),
                "timeframe_months": timeframe_months,
            }
        )
        
        # FIXED: Use LLM service instead of hardcoded template data
        llm = get_llm_service()  # Use singleton to avoid per-request overhead
        
        # Extract missing skills (target_skills not in current_skills)
        missing_skills = [s for s in target_skills if s.lower() not in [c.lower() for c in current_skills]]
        
        # Generate roadmap using LLM (not hardcoded)
        roadmap_output = llm.generate_learning_roadmap(
            target_role=career_title,
            missing_skills=missing_skills or target_skills,  # Use target skills if no delta needed
            current_experience=experience_level,
            rag_context=career_description or f"Career path towards {career_title}",
        )
        
        # Check if LLM failed
        if not roadmap_output.get("success"):
            logger.error(
                f"[API] LLM roadmap generation failed",
                extra={
                    "user_id": user_id,
                    "career": career_title,
                    "error": roadmap_output.get("error", "Unknown error"),
                }
            )
            return jsonify({
                "success": False,
                "error": roadmap_output.get("error", "Failed to generate roadmap"),
                "code": "ROADMAP_GENERATION_FAILED"
            }), 500
        
        # Extract phases from LLM output and convert to steps format
        phases = roadmap_output.get("phases", [])
        total_months = roadmap_output.get("total_months", timeframe_months)
        resources = roadmap_output.get("resources", [])
        
        # FIXED: Convert phases to steps with correct field names matching LLM output
        roadmap_steps = [
            {
                "title": phase.get("title", f"Phase {i+1}"),
                "timeframe": f"{phase.get('duration_months', 2)} months",
                "resources": phase.get("resources", []),
                "skills": phase.get("skills", []),
                "milestones": phase.get("milestones", []),
            }
            for i, phase in enumerate(phases)
        ]
        
        logger.info(
            "[API] Roadmap generation complete (via LLM)",
            extra={
                "user_id": user_id,
                "career": career_title,
                "steps_count": len(roadmap_steps),
                "source": roadmap_output.get("source", "unknown"),
            }
        )
        
        return jsonify({
            "success": True,
            "data": {
                "career_title": career_title,
                "career_description": career_description,
                "current_skills": current_skills,
                "target_skills": target_skills,
                "steps": roadmap_steps,
                "total_timeframe": f"{timeframe_months} months",
                "confidence_score": 0.85,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }), 200
        
    except ValueError as e:
        logger.warning(f"[API] Roadmap generation validation error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "VALIDATION_ERROR"
        }), 400
        
    except Exception as e:
        logger.error(f"[API] Roadmap generation failed: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "code": "ROADMAP_ERROR"
        }), 500

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        "success": False,
        "error": "Endpoint not found",
        "code": "NOT_FOUND",
        "path": request.path,
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"[API] Internal server error: {str(error)}", exc_info=True)
    return jsonify({
        "success": False,
        "error": "Internal server error",
        "code": "INTERNAL_ERROR",
    }), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("FLASK_ENV") == "development"
    
    logger.info(f"Starting AI Integration Backend on port {port} (debug={debug})")
    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug,
        threaded=True,
    )
