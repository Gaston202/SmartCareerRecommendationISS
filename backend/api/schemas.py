"""
API Request/Response Schemas for FastAPI endpoints.

Defines request/response models for mobile-specific request formats and response wrappers.
All models use Pydantic for validation and automatic OpenAPI documentation.

NOTE: UserProfile is defined here (not imported from ai_v2) to avoid startup failures
if ai_v2 dependencies aren't available.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ========================
# USER PROFILE
# ========================

class UserProfile(BaseModel):
    """User profile information for career recommendations."""
    user_id: str = Field(..., description="Unique user identifier")
    name: str = Field(..., description="User's full name")
    email: str = Field(..., description="User's email address")
    current_skills: List[str] = Field(
        default_factory=list,
        description="Current skills (e.g., ['Python', 'JavaScript'])"
    )
    experience_level: str = Field(
        default="entry",
        description="Career experience level (entry/mid/senior)"
    )
    education: Optional[str] = Field(
        default=None,
        description="Educational background (e.g., Bachelor's in CS)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "name": "John Doe",
                "email": "john@example.com",
                "current_skills": ["Python", "JavaScript", "SQL"],
                "experience_level": "entry",
                "education": "Bachelor's in Computer Science",
            }
        }


# ========================
# HEALTH CHECK
# ========================

class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Status (healthy/degraded/unhealthy)")
    timestamp: str = Field(..., description="ISO timestamp")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="API version")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "timestamp": "2025-03-25T10:30:00",
                "service": "career-recommendation-api",
                "version": "1.0.0"
            }
        }


# ========================
# CAREER MATCHING
# ========================

class CareerMatchingRequest(BaseModel):
    """Request model for career matching endpoint."""
    user_id: str = Field(..., description="Unique user identifier")
    user_profile: UserProfile = Field(..., description="User profile data")
    cv_text: Optional[str] = Field(
        default=None,
        description="CV text content (optional)"
    )
    job_market_data: Optional[str] = Field(
        default=None,
        description="Job market context (optional)"
    )
    preferences: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Career preferences (optional)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "user_profile": {
                    "user_id": "user_123",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "current_skills": ["Python", "JavaScript"],
                    "experience_level": "entry",
                    "education": "Bachelor's in CS"
                },
                "cv_text": "Software developer with 2 years of experience...",
                "preferences": {
                    "preferred_locations": ["Remote", "US"],
                    "salary_range": "60k-80k"
                }
            }
        }


class CareerMatch(BaseModel):
    """A single career recommendation."""
    role: str = Field(..., description="Job role title")
    match_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
        alias="matchScore",
        description="Match score as percentage (0-100)"
    )
    growth_trajectory: Optional[str] = Field(
        default=None,
        alias="growthTrajectory",
        description="Career growth path"
    )
    salary_range: Optional[str] = Field(
        default=None,
        alias="salaryRange",
        description="Expected salary range"
    )
    market_demand: Optional[str] = Field(
        default=None,
        alias="marketDemand",
        description="Market demand (high/medium/low)"
    )
    description: Optional[str] = Field(
        default=None,
        description="Additional context"
    )
    required_skills: Optional[List[str]] = Field(
        default=None,
        description="Required skills for the role"
    )

    class Config:
        # Allow both snake_case (from AI) and camelCase (to mobile)
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "role": "Backend Engineer",
                "matchScore": 92,
                "growthTrajectory": "Senior Backend Engineer → Tech Lead",
                "salaryRange": "$80k - $120k",
                "marketDemand": "high",
                "description": "Strong match for your Python skills"
            }
        }


class CareerMatchingResponse(BaseModel):
    """Response model for career matching endpoint (standardized format)."""
    success: bool = Field(..., description="Request success status")
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Response data with careers and confidence"
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if failed"
    )
    timestamp: str = Field(..., description="ISO timestamp")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "user_id": "user_123",
                    "careers": [
                        {
                            "role": "Backend Engineer",
                            "matchScore": 92,
                            "growthTrajectory": "Senior Backend Engineer → Tech Lead",
                            "salaryRange": "$80k - $120k",
                            "marketDemand": "high",
                            "description": "Strong match for your Python skills"
                        }
                    ],
                    "confidence_score": 85
                },
                "error": None,
                "timestamp": "2025-03-27T10:30:00"
            }
        }


# ========================
# QUIZ GENERATION
# ========================

class QuizGeneratorRequest(BaseModel):
    """Request model for quiz generation endpoint."""
    user_id: str = Field(..., description="Unique user identifier")
    user_profile: UserProfile = Field(..., description="User profile data")
    num_questions: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of questions to generate"
    )
    quiz_type: Optional[str] = Field(
        default="career_assessment",
        description="Type of quiz (career_assessment, skill_check, interest_exploration)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "user_profile": {
                    "user_id": "user_123",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "current_skills": ["Python"],
                    "experience_level": "entry"
                },
                "num_questions": 5,
                "quiz_type": "career_assessment"
            }
        }


class QuizQuestion(BaseModel):
    """A single quiz question."""
    id: int = Field(..., description="Question ID")
    question: str = Field(..., description="Question text")
    type: str = Field(..., description="Question type (text/choice/rating/multiple)")
    options: Optional[List[str]] = Field(
        default=None,
        description="Answer options for choice/multiple questions"
    )
    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional context or metadata"
    )


class QuizGeneratorResponse(BaseModel):
    """Response model for quiz generation endpoint."""
    success: bool = Field(..., description="Request success status")
    user_id: str = Field(..., description="User identifier")
    questions: List[QuizQuestion] = Field(
        default_factory=list,
        description="Generated quiz questions"
    )
    total_questions: int = Field(
        default=0,
        description="Number of questions"
    )
    timestamp: str = Field(..., description="ISO timestamp")
    error: Optional[str] = Field(
        default=None,
        description="Error message if failed"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user_id": "user_123",
                "questions": [
                    {
                        "id": 1,
                        "question": "How interested are you in a career as a Backend Engineer?",
                        "type": "rating",
                        "options": ["Not interested", "Somewhat interested", "Very interested"],
                        "context": {
                            "role": "Backend Engineer",
                            "match_score": 0.92
                        }
                    },
                    {
                        "id": 2,
                        "question": "Which of these technologies are you familiar with?",
                        "type": "multiple",
                        "options": ["Python", "Java", "Go", "Rust", "C++"],
                        "context": {}
                    }
                ],
                "total_questions": 2,
                "timestamp": "2025-03-25T10:30:00"
            }
        }


# ========================
# ROADMAP GENERATION
# ========================

class RoadmapGeneratorRequest(BaseModel):
    """Request model for roadmap generation endpoint."""
    user_id: str = Field(..., description="Unique user identifier")
    user_profile: UserProfile = Field(..., description="User profile data")
    target_career: str = Field(..., description="Target career role")
    timeframe_months: Optional[int] = Field(
        default=12,
        ge=1,
        le=60,
        description="Desired timeframe to reach target (months)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "user_profile": {
                    "user_id": "user_123",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "current_skills": ["Python"],
                    "experience_level": "entry"
                },
                "target_career": "Backend Engineer",
                "timeframe_months": 12
            }
        }


class RoadmapPhase(BaseModel):
    """A single phase in a learning roadmap."""
    phase: int = Field(..., description="Phase number")
    title: str = Field(..., description="Phase title")
    duration_months: int = Field(..., description="Estimated duration in months")
    skills_to_learn: List[str] = Field(
        default_factory=list,
        description="Skills to learn in this phase"
    )
    difficulty: Optional[str] = Field(
        default=None,
        description="Difficulty (beginner/intermediate/advanced)"
    )
    resources: List[str] = Field(
        default_factory=list,
        description="Learning resources"
    )
    milestones: List[str] = Field(
        default_factory=list,
        description="Key milestones to achieve"
    )
    estimated_cost: Optional[str] = Field(
        default=None,
        description="Estimated cost"
    )


class RoadmapGeneratorResponse(BaseModel):
    """Response model for roadmap generation endpoint."""
    success: bool = Field(..., description="Request success status")
    user_id: str = Field(..., description="User identifier")
    target_career: str = Field(..., description="Target career")
    roadmap: List[RoadmapPhase] = Field(
        default_factory=list,
        description="Roadmap phases"
    )
    total_phases: int = Field(..., description="Number of phases")
    estimated_total_months: int = Field(..., description="Total timeframe estimate")
    timestamp: str = Field(..., description="ISO timestamp")
    error: Optional[str] = Field(
        default=None,
        description="Error message if failed"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "user_id": "user_123",
                "target_career": "Backend Engineer",
                "roadmap": [
                    {
                        "phase": 1,
                        "title": "Python Fundamentals",
                        "duration_months": 3,
                        "skills_to_learn": ["Python basics", "OOP", "Testing"],
                        "difficulty": "beginner",
                        "resources": [
                            "Python.org Tutorial",
                            "Codecademy Python Course",
                            "Real Python Articles"
                        ],
                        "milestones": [
                            "Complete Python basics",
                            "Build first small project",
                            "Understand OOP principles"
                        ],
                        "estimated_cost": "$50-100"
                    },
                    {
                        "phase": 2,
                        "title": "Web Frameworks",
                        "duration_months": 3,
                        "skills_to_learn": ["Django/FastAPI", "REST APIs", "Database design"],
                        "difficulty": "intermediate",
                        "resources": [
                            "Official Django/FastAPI docs",
                            "Full Stack Python",
                            "Real Project Development"
                        ],
                        "milestones": [
                            "Build first REST API",
                            "Design database schema",
                            "Implement authentication"
                        ],
                        "estimated_cost": "Free (open source tools)"
                    }
                ],
                "total_phases": 2,
                "estimated_total_months": 6,
                "timestamp": "2025-03-25T10:30:00"
            }
        }
