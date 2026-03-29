"""
FastAPI Backend - AI v2 Pipeline Wrapper

Exposes the ai_v2 career recommendation pipeline to mobile and admin apps
via HTTP endpoints. All endpoints return normalized JSON responses.

Quick Start:
    uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
    GET  /health              - Health check
    POST /career-matching     - AI career matching from user profile
    POST /generate-quiz       - Generate quiz questions
    POST /generate-roadmap    - Generate learning roadmap
"""

import os
import sys
import logging
from datetime import datetime
from typing import Optional, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
import time
import traceback

# Lazy imports - will try to import ai_v2 only when needed
_ai_pipeline = None
_ai_pipeline_error = None

def get_ai_pipeline():
    """Get or initialize AI pipeline, with error handling"""
    global _ai_pipeline, _ai_pipeline_error
    
    if _ai_pipeline is not None:
        return _ai_pipeline
    
    if _ai_pipeline_error is not None:
        raise RuntimeError(f"AI pipeline initialization failed: {_ai_pipeline_error}")
    
    try:
        from ai_v2.main_pipeline import CareerRecommendationPipeline
        _ai_pipeline = CareerRecommendationPipeline()
        return _ai_pipeline
    except ImportError as e:
        _ai_pipeline_error = str(e)
        raise RuntimeError(f"Could not load AI pipeline: {e}")

def get_user_profile_class():
    """Get UserProfile class"""
    try:
        from ai_v2.schemas import UserProfile
        return UserProfile
    except ImportError:
        # Fallback minimal definition
        from pydantic import BaseModel, Field
        from typing import List
        class UserProfile(BaseModel):
            user_id: str = Field(..., description="Unique user identifier")
            name: str = Field(..., description="User's full name")
            email: str = Field(..., description="User's email address")
            current_skills: List[str] = Field(default_factory=list, description="Current skills")
            experience_level: str = Field(default="entry", description="Career experience level")
            education: Optional[str] = Field(default=None, description="Educational background")
        return UserProfile

def get_logger_func(name):
    """Get logger with fallback"""
    try:
        from ai_v2.utils import get_logger
        return get_logger(name)
    except ImportError:
        return logging.getLogger(name)

# API schemas
try:
    from .schemas import (
        CareerMatchingRequest,
        CareerMatchingResponse,
        QuizGeneratorRequest,
        QuizGeneratorResponse,
        RoadmapGeneratorRequest,
        RoadmapGeneratorResponse,
        HealthCheckResponse,
    )
except ImportError:
    # Fallback if schemas can't be imported
    from api.schemas import (
        CareerMatchingRequest,
        CareerMatchingResponse,
        QuizGeneratorRequest,
        QuizGeneratorResponse,
        RoadmapGeneratorRequest,
        RoadmapGeneratorResponse,
        HealthCheckResponse,
    )

# Load environment variables
load_dotenv()

# Setup logging
logger = get_logger_func(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Initialize FastAPI app
app = FastAPI(
    title="Smart Career Recommendation API",
    description="AI-powered career matching & learning roadmap generation",
    version="1.0.0"
)

# CORS configuration - Allow requests from mobile and web clients
ALLOWED_ORIGINS = [
    "http://localhost:3000",          # Admin dashboard
    "http://localhost:3001",          # Alternative admin port
    "http://localhost:8081",          # Expo web
    "http://localhost:19006",         # Expo alternative
    "http://192.168.0.9:8081",        # Mobile device (adjust as needed)
    "http://192.168.0.9:19006",       # Mobile device alternative
]

# Allow all origins for development (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with ALLOWED_ORIGINS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================
# CUSTOM MIDDLEWARE
# ========================

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs all HTTP requests with timing information."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_id = str(time.time()).replace('.', '')[-8:]  # Simple request ID
        
        # Log request
        logger.info(f"[{request_id}] {request.method} {request.url.path}")
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(f"[{request_id}] Response: {response.status_code} ({process_time:.3f}s)")
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"[{request_id}] Error: {str(e)} ({process_time:.3f}s)")
            raise


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Catches unhandled exceptions and returns formatted error responses."""
    
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            logger.error(f"Unhandled error: {str(e)}\n{traceback.format_exc()}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "success": False,
                    "error": "Internal server error",
                    "detail": str(e) if os.getenv("DEBUG") else "An error occurred",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )


# Register middleware (order matters - last registered is first executed)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestLoggingMiddleware)


# ========================
# EXCEPTION HANDLERS
# ========================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with detailed information."""
    logger.warning(f"Validation error on {request.method} {request.url.path}: {exc}")
    
    # Extract error details
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"][1:]),
            "error": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Validation error",
            "details": errors,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent format."""
    logger.warning(f"HTTP error {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )

# Global pipeline instance
_pipeline = None


@app.on_event("startup")
async def startup_event():
    """Called when the server starts."""
    logger.info("🚀 API Server starting...")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")


@app.on_event("shutdown")
async def shutdown_event():
    """Called when the server shuts down."""
    logger.info("🛑 API Server shutting down...")


@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Health check endpoint.
    
    Returns basic server status information.
    Useful for mobile apps to verify backend connectivity.
    """
    logger.debug("Health check requested")
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="career-recommendation-api",
        version="1.0.0"
    )


@app.post("/career-matching", response_model=CareerMatchingResponse)
async def career_matching(request: CareerMatchingRequest):
    """
    AI Career Matching Endpoint.
    
    Analyzes user profile (and optionally CV) to recommend suitable careers.
    Uses the multi-agent pipeline to:
    1. Analyze user profile
    2. Parse CV (if provided)
    3. Match against job market
    4. Generate recommendations
    
    Args:
        request: CareerMatchingRequest with user profile and optional CV
    
    Returns:
        CareerMatchingResponse with career recommendations and analysis
    
    Example:
        POST /career-matching
        {
            "user_id": "user_123",
            "user_profile": {
                "user_id": "user_123",
                "name": "John Doe",
                "email": "john@example.com",
                "current_skills": ["Python", "JavaScript"],
                "experience_level": "entry"
            },
            "cv_text": "Software Engineer with 2 years experience..."
        }
    """
    try:
        logger.info(f"Career matching request for user: {request.user_id}")
        
        # Validate input
        if not request.user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_profile is required"
            )
        
        # Get AI pipeline
        pipeline = get_ai_pipeline()
        
        # Build request for AI pipeline
        logger.debug(f"Processing recommendation for {request.user_id}...")
        
        # Run the pipeline
        result = pipeline.recommend(
            user_profile=request.user_profile,
            cv_text=request.cv_text,
            job_market_data=request.job_market_data,
            preferences=request.preferences,
        )
        
        # DEBUG: Log raw result
        logger.debug(f"RAW CAREER RESPONSE: {len(result.recommended_careers)} careers")
        for i, career in enumerate(result.recommended_careers[:3]):
            logger.debug(f"  Career {i}: {career.role}")
        
        # VALIDATION: Check if we got any recommendations
        if not result.recommended_careers:
            logger.warning(f"Career matching returned no careers for {request.user_id}")
            response = CareerMatchingResponse(
                success=False,
                data={
                    "user_id": request.user_id,
                    "careers": [],
                    "confidence_score": 0,
                },
                error="Career matching returned no recommendations",
                timestamp=datetime.utcnow().isoformat(),
            )
            return response
        
        # Build standardized response
        response = CareerMatchingResponse(
            success=True,
            data={
                "user_id": request.user_id,
                "careers": [
                    {
                        "role": career.role,
                        "match_score": int(career.match_score * 100) if career.match_score else None,
                        "matchScore": int(career.match_score * 100) if career.match_score else None,
                        "growth_trajectory": career.growth_trajectory,
                        "growthTrajectory": career.growth_trajectory,
                        "salary_range": career.salary_range,
                        "salaryRange": career.salary_range,
                        "market_demand": career.market_demand,
                        "marketDemand": career.market_demand,
                        "description": career.description,
                    }
                    for career in result.recommended_careers
                ],
                "confidence_score": int(result.confidence_score * 100) if result.confidence_score else None,
            },
            error=None,
            timestamp=datetime.utcnow().isoformat(),
        )
        
        logger.info(f"✅ Career matching completed for {request.user_id}: {len(result.recommended_careers)} careers")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Career matching failed: {str(e)}", exc_info=True)
        response = CareerMatchingResponse(
            success=False,
            data=None,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )
        return response


@app.post("/generate-quiz", response_model=QuizGeneratorResponse)
async def generate_quiz(request: QuizGeneratorRequest):
    """
    Quiz Generation Endpoint.
    
    Generates personalized career assessment quiz questions based on
    user profile and existing knowledge. Uses the profile agent to
    understand the user before generating questions.
    
    Args:
        request: QuizGeneratorRequest with user profile
    
    Returns:
        QuizGeneratorResponse with quiz questions
    
    Example:
        POST /generate-quiz
        {
            "user_id": "user_123",
            "user_profile": {
                "user_id": "user_123",
                "name": "John Doe",
                "email": "john@example.com",
                "current_skills": ["Python"],
                "experience_level": "entry"
            },
            "num_questions": 5
        }
    """
    try:
        logger.info(f"Quiz generation request for user: {request.user_id}")
        
        # Validate user_id is a real UUID (not the "app-user" fallback from mobile)
        if not request.user_id or request.user_id == "app-user" or request.user_id.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid user_id (UUID) is required. Cannot use 'app-user' placeholder."
            )
        
        # Validate input
        if not request.user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_profile is required"
            )
        
        # Get AI pipeline
        pipeline = get_ai_pipeline()
        
        logger.debug(f"Generating {request.num_questions} quiz questions...")
        
        # Use Adaptive Quiz Generator for interest-based discovery
        try:
            from ai_v2.services.quiz_generator import AdaptiveQuizGenerator
            quiz_gen = AdaptiveQuizGenerator()
            
            # Generate a sequence of adaptive questions
            quiz_questions = []
            previous_answers = []
            
            for q_num in range(1, min(request.num_questions + 1, 8)):  # Max 7 questions
                if q_num == 1:
                    # First question
                    response = quiz_gen.get_first_question()
                else:
                    # Subsequent questions depend on previous answers
                    # For now, just generate generic progressive questions
                    response_obj = quiz_gen.generate_next_question(
                        previous_answers=previous_answers,
                        current_profile=request.user_profile if hasattr(request, 'user_profile') else None,
                    )
                    response = response_obj.data if response_obj.success else None
                
                if response:
                    # Extract options and flatten to strings if they're dicts
                    options = response.get("options", [])
                    if options and isinstance(options[0], dict):
                        # Convert dict options to strings (label only)
                        options = [opt.get("label", str(opt)) for opt in options]
                    
                    quiz_questions.append({
                        "id": q_num,
                        "question": response.get("question", ""),
                        "type": "multiple-choice",
                        "options": options,
                        "context": {
                            "category": response.get("category", "interest_discovery"),
                        }
                    })
            
            logger.debug(f"Generated {len(quiz_questions)} adaptive quiz questions")
        
        except Exception as e:
            logger.warning(f"Adaptive quiz generation failed, falling back to pipeline: {e}")
            # Fallback to old method if adaptive fails
            result = pipeline.recommend(
                user_profile=request.user_profile,
            )
            
            # Transform recommendations into quiz format
            quiz_questions = [
                {
                    "id": i + 1,
                    "question": f"How interested are you in a career as a {career.role}?",
                    "type": "rating",
                    "options": ["Not interested", "Somewhat interested", "Very interested"],
                    "context": {
                        "role": career.role,
                        "matchScore": int(career.match_score * 100) if career.match_score else None,
                    }
                }
                for i, career in enumerate(result.recommended_careers[:request.num_questions])
            ]
        
        logger.debug(f"Generated quiz raw output: {quiz_questions}")
        logger.debug(f"Parsed questions: {len(quiz_questions)}")
        logger.debug(f"Questions count: {len(quiz_questions)}")
        
        # VALIDATION: Don't return success if no questions generated
        if not quiz_questions:
            logger.warning(f"Quiz generation returned empty questions array")
            response = QuizGeneratorResponse(
                success=False,
                user_id=request.user_id,
                questions=[],
                total_questions=0,
                error="Quiz generation returned no questions - no recommended careers found",
                timestamp=datetime.utcnow().isoformat(),
            )
            return response
        
        response = QuizGeneratorResponse(
            success=True,
            user_id=request.user_id,
            questions=quiz_questions,
            total_questions=len(quiz_questions),
            timestamp=datetime.utcnow().isoformat(),
        )
        
        logger.info(f"✅ Generated {len(quiz_questions)} quiz questions for {request.user_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Quiz generation failed: {str(e)}", exc_info=True)
        response = QuizGeneratorResponse(
            success=False,
            user_id=request.user_id,
            questions=[],
            total_questions=0,
            error=str(e),
            timestamp=datetime.utcnow().isoformat(),
        )
        return response


@app.post("/generate-roadmap", response_model=RoadmapGeneratorResponse)
async def generate_roadmap(request: RoadmapGeneratorRequest):
    """
    Learning Roadmap Generation Endpoint.
    
    Creates a personalized learning roadmap for a target career.
    Analyzes skill gaps and creates a step-by-step plan with:
    - Learning phases
    - Required skills per phase
    - Time estimates
    - Learning resources
    
    Args:
        request: RoadmapGeneratorRequest with user profile and target career
    
    Returns:
        RoadmapGeneratorResponse with roadmap steps
    
    Example:
        POST /generate-roadmap
        {
            "user_id": "user_123",
            "user_profile": {
                "user_id": "user_123",
                "name": "John Doe",
                "email": "john@example.com",
                "current_skills": ["Python"],
                "experience_level": "entry"
            },
            "target_career": "Backend Engineer"
        }
    """
    try:
        logger.info(f"Roadmap generation request for user: {request.user_id}")
        
        # Validate user_id is a real UUID (not the "app-user" fallback from mobile)
        if not request.user_id or request.user_id == "app-user" or request.user_id.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid user_id (UUID) is required. Cannot use 'app-user' placeholder."
            )
        
        # Validate input
        if not request.user_profile or not request.target_career:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_profile and target_career are required"
            )
        
        # Get AI pipeline
        pipeline = get_ai_pipeline()
        
        logger.debug(f"Generating roadmap for target: {request.target_career}...")
        
        # Run the pipeline (note: pipeline.recommend() doesn't take target_career parameter)
        result = pipeline.recommend(
            user_profile=request.user_profile,
        )
        
        # DEBUG: Log raw roadmap result
        logger.debug(f"RAW ROADMAP RESPONSE: {len(result.roadmap) if result.roadmap else 0} steps")
        if result.roadmap:
            for i, step in enumerate(result.roadmap[:3]):
                logger.debug(f"  Step {i}: {step.title if hasattr(step, 'title') else step}")
        else:
            logger.warning(f"Empty roadmap returned from pipeline for {request.target_career}")
        
        # VALIDATION: Check if we got any roadmap steps
        if not result or not result.roadmap:
            logger.warning(f"Roadmap generation returned no steps for {request.user_id}, target: {request.target_career}")
            response = RoadmapGeneratorResponse(
                success=False,
                user_id=request.user_id,
                target_career=request.target_career,
                roadmap=[],
                total_phases=0,
                estimated_total_months=0,
                error="Roadmap generation returned no steps. Pipeline may need retry.",
                timestamp=datetime.utcnow().isoformat(),
            )
            return response
        
        # Extract roadmap steps (already generated by roadmap agent)
        roadmap_steps = [
            {
                "phase": step.phase,
                "title": step.title,
                "duration_months": step.duration_months,
                "skills_to_learn": step.skills_to_learn,
                "difficulty": step.difficulty,
                "resources": step.resources or [],
                "milestones": step.milestones or [],
                "estimated_cost": step.estimated_cost,
            }
            for step in result.roadmap
        ]
        
        response = RoadmapGeneratorResponse(
            success=True,
            user_id=request.user_id,
            target_career=request.target_career,
            roadmap=roadmap_steps,
            total_phases=len(roadmap_steps),
            estimated_total_months=sum(step["duration_months"] for step in roadmap_steps),
            timestamp=datetime.utcnow().isoformat(),
        )
        
        logger.info(f"✅ Generated roadmap with {len(roadmap_steps)} phases for {request.user_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Roadmap generation failed: {str(e)}", exc_info=True)
        # Return graceful error response instead of 500
        return RoadmapGeneratorResponse(
            success=False,
            user_id=request.user_id,
            target_career=getattr(request, 'target_career', 'unknown'),
            roadmap=[],
            total_phases=0,
            estimated_total_months=0,
            error=f"Roadmap generation error: {str(e)}",
            timestamp=datetime.utcnow().isoformat(),
        )


# ============================================================================
# ADAPTIVE QUIZ AND PROFILE ENDPOINTS
# ============================================================================
# Import quiz routes module
try:
    from .quiz_routes import (
        create_quiz_routes,
        create_cv_routes,
        create_profile_routes,
    )
    
    logger.info("Registering adaptive quiz, CV, and profile routes...")
    create_quiz_routes(app)
    create_cv_routes(app)
    create_profile_routes(app)
    logger.info("✅ Adaptive routes registered successfully")
except ImportError as e:
    logger.warning(f"⚠️  Could not import quiz routes: {e}")
except Exception as e:
    logger.error(f"❌ Failed to register quiz routes: {e}", exc_info=True)


@app.get("/")
async def root():
    """Root endpoint - returns API information."""
    return {
        "message": "Smart Career Recommendation API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "new_endpoints": {
            "quiz": "/quiz/next-question (POST), /quiz/save-answer (POST)",
            "cv": "/cv/analyze (POST)",
            "profile": "/profile/merge (POST), /profile/{user_id} (GET)"
        }
    }


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    logger.error(f"HTTP error {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Internal server error",
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
