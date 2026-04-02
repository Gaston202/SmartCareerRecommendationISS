"""
Quiz and Profile Schemas for Adaptive Question Generation and Profile Building.

This module defines the data structures for:
- Adaptive quiz question generation
- User profile building from quiz + CV
- Quiz answer tracking
- Evidence-based profile merging
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timezone


class QuestionCategory(str, Enum):
    """Categories for quiz questions to enable adaptive questioning."""
    INTEREST_DISCOVERY = "interest_discovery"           # Initial interest exploration
    INTEREST_DEEPENING = "interest_deepening"           # Follow-up on interests
    SKILL_EXPLORATION = "skill_exploration"             # Technical skills
    WORK_ENVIRONMENT = "work_environment"               # Preferred work setting
    CHALLENGE_DISCOVERY = "challenge_discovery"         # What problems to solve
    STRENGTH_VALIDATION = "strength_validation"         # Strengths confirmation
    MOTIVATION = "motivation"                           # What motivates them
    DISLIKE_IDENTIFICATION = "dislike_identification"   # What they don't enjoy


class QuizAnswerEvidence(BaseModel):
    """Links quiz answers to profile attributes."""
    question: str = Field(..., description="The question asked")
    answer: str = Field(..., description="The user's answer")
    inferred_interests: List[str] = Field(default_factory=list, description="Interests inferred from answer")
    inferred_strengths: List[str] = Field(default_factory=list, description="Strengths inferred from answer")
    inferred_preferences: List[str] = Field(default_factory=list, description="Work preferences inferred from answer")
    inferred_dislikes: List[str] = Field(default_factory=list, description="Disliked tasks inferred from answer")


class QuizQuestionRequest(BaseModel):
    """Request for generating the next quiz question."""
    user_id: str = Field(..., description="User identifier")
    session_id: Optional[str] = Field(None, description="Quiz session identifier")
    previous_answers: List[QuizAnswerEvidence] = Field(
        default_factory=list,
        description="All previous answers in the quiz"
    )
    user_profile: Optional['UserProfileSchema'] = Field(
        default=None,
        description="Current cumulative user profile from quiz"
    )
    question_number: int = Field(default=1, description="Current question number (1-N)")


class QuizQuestionResponse(BaseModel):
    """Response with next quiz question (adaptive)."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "question_number": 2,
                    "question": "You mentioned solving logic problems. What excites you most: interface design, system logic, databases, or solving user problems?",
                    "category": "interest_deepening",
                    "based_on": "Solving logical problems and building apps",
                    "options": [
                        {"id": "opt_1", "label": "Interface design (UI/UX)"},
                        {"id": "opt_2", "label": "System logic & algorithms"},
                        {"id": "opt_3", "label": "Database design"},
                        {"id": "opt_4", "label": "Solving real user problems"}
                    ]
                }
            }
        }


class QuizAnswerRequest(BaseModel):
    """Request to save a quiz answer."""
    user_id: str = Field(..., description="User identifier")
    session_id: str = Field(..., description="Quiz session identifier")
    question_number: int = Field(..., description="Question number (1-based)")
    question: str = Field(..., description="The question asked")
    answer: str = Field(..., description="User's selected answer")
    reasoning: Optional[str] = Field(None, description="Optional reasoning about the answer")


class QuizAnswerResponse(BaseModel):
    """Response after saving quiz answer."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "saved": True,
                    "question_number": 1,
                    "profile_updated": True,
                    "current_profile": {
                        "interests": ["problem solving", "building"],
                        "strengths": ["logic", "implementation"],
                        "work_preferences": [],
                        "skills": []
                    }
                }
            }
        }


class CVEvidenceItem(BaseModel):
    """A specific piece of evidence extracted from CV."""
    type: str = Field(..., description="evidence | improvement | strength")
    text: str = Field(..., description="The text from the CV")
    context: str = Field(..., description="Context: where in CV this appears")
    inferred_skill: Optional[str] = Field(None, description="Skill inferred from this evidence")
    inferred_interest: Optional[str] = Field(None, description="Interest inferred from this evidence")


class CVImprovement(BaseModel):
    """A specific improvement suggestion with evidence."""
    issue: str = Field(..., description="What needs improvement")
    evidence_from_cv: str = Field(..., description="Exact or paraphrased text from CV")
    why_it_matters: str = Field(..., description="Why this matters for career prospects")
    improved_example: str = Field(..., description="Concrete example of improved text")
    section: Optional[str] = Field(None, description="CV section: experience, projects, education, skills")


class CVAnalysisRequest(BaseModel):
    """Request to analyze CV."""
    user_id: str = Field(..., description="User identifier")
    pdf_base64: Optional[str] = Field(
        default=None,
        description="Base64 encoded PDF content (preferred over cv_text)"
    )
    cv_text: Optional[str] = Field(
        default=None,
        description="Full CV text content (used if pdf_base64 not provided)"
    )
    cv_id: Optional[str] = Field(
        default=None,
        description="Optional CV upload ID for tracking"
    )
    file_name: Optional[str] = Field(
        default=None,
        description="Optional original filename"
    )
    current_profile: Optional['UserProfileSchema'] = Field(
        default=None,
        description="Current quiz profile to merge with"
    )


class CVAnalysisResponse(BaseModel):
    """Response from CV analysis."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "summary": "Strong technical foundation with web and software projects",
                    "strengths": [
                        "Web development",
                        "Project implementation",
                        "Technical versatility"
                    ],
                    "improvements": [
                        {
                            "issue": "Project description too vague",
                            "evidence_from_cv": "Doctor appointment web application",
                            "why_it_matters": "Recruiters need to understand scope and impact",
                            "improved_example": "Developed doctor appointment scheduling app using Vue.js with patient login, appointment booking, and health data forms",
                            "section": "projects"
                        }
                    ],
                    "extracted_evidence": {
                        "skills": ["Vue.js", "JavaScript", "Web development"],
                        "projects": ["Doctor appointment app"],
                        "experience": ["Web internship"],
                        "education": ["High school / College"]
                    },
                    "profile_updates": {
                        "interests": ["software development", "web apps", "healthcare"],
                        "skills": ["Vue.js", "JavaScript"],
                        "strengths": ["project implementation", "web development"],
                        "work_preferences": ["building practical solutions"]
                    }
                }
            }
        }


class UserProfileSchema(BaseModel):
    """
    Complete user profile from quiz + CV.
    
    This is the single source of truth for user attributes,
    combining:
    - Quiz self-reported preferences
    - CV evidence of skills/projects
    - Inferred insights
    """
    user_id: str = Field(..., description="User identifier")
    
    # Self-reported preferences (from quiz)
    interests: List[str] = Field(default_factory=list, description="What they enjoy")
    hobbies: List[str] = Field(default_factory=list, description="Personal projects/hobbies")
    work_preferences: List[str] = Field(default_factory=list, description="Preferred work environment/style")
    strengths: List[str] = Field(default_factory=list, description="Self-identified strengths")
    preferred_problems: List[str] = Field(default_factory=list, description="Types of problems to solve")
    
    # Evidence from CV (observed abilities)
    cv_skills: List[str] = Field(default_factory=list, description="Technical skills from CV")
    cv_projects: List[str] = Field(default_factory=list, description="Project descriptions from CV")
    cv_background: Optional[str] = Field(None, description="Educational/professional background from CV")
    
    # Inferred insights
    inferred_skills: List[str] = Field(default_factory=list, description="Inferred from quiz + CV")
    inferred_interests: List[str] = Field(default_factory=list, description="Inferred from CV evidence")
    
    # Things they explicitly don't like
    disliked_tasks: List[str] = Field(default_factory=list, description="Tasks/environments they don't like")
    
    # Metadata
    evidence: Dict[str, List[str]] = Field(
        default_factory=lambda: {"quiz": [], "cv": []},
        description="Supporting evidence: what quiz or CV data led to each attribute"
    )
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="Confidence in profile (0-1)")
    last_updated: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO timestamp of last update"
    )


class ProfileMergeRequest(BaseModel):
    """Request to merge quiz + CV profiles."""
    user_id: str = Field(..., description="User identifier")
    quiz_profile: UserProfileSchema = Field(..., description="Profile from quiz alone")
    cv_profile: UserProfileSchema = Field(..., description="Profile from CV analysis")


class ProfileMergeResponse(BaseModel):
    """Response with merged profile."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "profile": {
                        "user_id": "user_123",
                        "interests": ["problem solving", "software development", "healthcare"],
                        "hobbies": ["building projects", "learning new tech"],
                        "strengths": ["logic", "implementation", "web development"],
                        "work_preferences": ["hands-on", "collaborative", "learning"],
                        "cv_skills": ["Vue.js", "JavaScript", "React"],
                        "cv_projects": ["Doctor appointment app", "Portfolio website"],
                        "inferred_skills": ["System design", "User experience"],
                        "disliked_tasks": ["Repetitive tasks", "No collaboration"],
                        "confidence": 0.85,
                        "evidence": {
                            "quiz": [
                                "User said they enjoy solving logical problems",
                                "User said they prefer collaborative environments"
                            ],
                            "cv": [
                                "Built doctor appointment web app with Vue.js",
                                "Web internship with focus on patient management"
                            ]
                        }
                    },
                    "recommendations": [
                        "Backend development suits your problem-solving focus",
                        "Healthcare tech aligns with your project history"
                    ]
                }
            }
        }
