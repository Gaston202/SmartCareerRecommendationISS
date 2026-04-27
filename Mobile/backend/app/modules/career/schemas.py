from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime


class CareerBase(BaseModel):
    id: str
    title: str
    description: str
    category: str
    required_skills: List[str]
    preferred_interests: List[str] = []
    typical_traits: List[str] = []
    tags: List[str] = []
    average_salary: float
    growth_rate: float
    demand_level: str  # 'low' | 'medium' | 'high' | 'very-high'
    salary_range_min: float
    salary_range_max: float
    growth_potential: str
    is_active: bool


class CareerResponse(CareerBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CareerMatchBase(BaseModel):
    career: CareerResponse
    match_score: int = Field(..., ge=0, le=100)
    match_reasons: List[str]
    ai_explanation: str


class CareerMatchResponse(CareerMatchBase):
    pass


class RecommendCareersRequest(BaseModel):
    quiz_session_id: str
    cv_analysis_id: Optional[str] = None
    nova_profile: Optional[Any] = None