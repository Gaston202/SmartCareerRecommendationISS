from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class RecommendCareersRequest(BaseModel):
    """Request for career recommendations."""
    quiz_session_id: Optional[str] = None
    cv_analysis_id: Optional[str] = None
    nova_profile: Optional[dict] = None


class CareerMatchResponse(BaseModel):
    """Career match response."""
    id: str
    title: str
    match_score: int
    reasoning: str
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    salary_range: Optional[dict] = None
    growth_outlook: Optional[dict] = None


class CareerListResponse(BaseModel):
    """List of all careers."""
    careers: List[dict] = Field(default_factory=list)


class CareerHealthResponse(BaseModel):
    """Health check response."""
    module: str = "career"
    status: str = "ok"