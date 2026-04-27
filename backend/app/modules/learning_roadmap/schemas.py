from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime


class LearningSkill(BaseModel):
    id: str
    name: str
    description: str
    level: str  # 'beginner' | 'intermediate' | 'advanced'
    duration_hours: int = Field(..., ge=0)
    category: str
    importance: str  # 'critical' | 'important' | 'nice-to-have'
    prerequisites: List[str] = []


class LearningCourse(BaseModel):
    id: str
    skill_id: str
    title: str
    description: Optional[str] = None
    provider: str
    url: str
    duration_hours: Optional[int] = Field(None, ge=0)
    level: str
    rating: Optional[float] = Field(None, ge=0, le=5)
    free: bool = False
    course_type: str


class LearningRoadmapSkill(BaseModel):
    skill: LearningSkill
    courses: List[LearningCourse] = []
    dependencies: List[LearningSkill] = []


class LearningRoadmapResponse(BaseModel):
    id: str
    user_id: str
    career_id: str
    career_title: str
    title: str
    description: str
    skills: List[LearningRoadmapSkill] = []
    total_duration_hours: int = Field(..., ge=0)
    estimated_weeks: int = Field(..., ge=0)
    skill_count: int = Field(..., ge=0)
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateLearningRoadmapRequest(BaseModel):
    career_id: str
    career_title: str
    career_description: str
    user_profile: Optional[dict] = None