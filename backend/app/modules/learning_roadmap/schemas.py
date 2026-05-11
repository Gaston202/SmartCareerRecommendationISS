from pydantic import BaseModel, Field
from typing import List, Optional, Any, Literal, Dict
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
    career_id: Optional[str] = None
    career_title: str
    career_description: Optional[str] = None
    max_steps: int = Field(default=6, ge=1, le=20)
    user_profile: Optional[dict] = None


RoadmapLevel = Literal["beginner", "intermediate", "advanced"]


class LearningRoadmapStep(BaseModel):
    skill_name: str
    why_it_matters: str
    difficulty: RoadmapLevel
    estimated_duration_hours: int = Field(..., ge=1)
    prerequisites: List[str] = []
    resource_title: Optional[str] = None
    provider: Optional[str] = None
    source_url: Optional[str] = None
    confidence_score: float = Field(default=0.7, ge=0, le=1)
    order_index: int = Field(..., ge=0)


class LearningRoadmapGenerateResponse(BaseModel):
    success: bool = True
    mode: str = "learning_roadmap_v1"
    target_role: str
    career_id: Optional[str] = None
    confidence: float = Field(default=0.7, ge=0, le=1)
    weak_evidence: bool = False
    message: Optional[str] = None
    steps: List[LearningRoadmapStep]
    roadmap: Dict[str, Any]


class SaveLearningRoadmapRequest(BaseModel):
    career_id: str
    career_title: str
    roadmap_data: Dict[str, Any]


class UpdateLearningRoadmapProgressRequest(BaseModel):
    roadmap_id: str
    skill_id: str
    started: Optional[bool] = None
    completed_percentage: Optional[int] = Field(default=None, ge=0, le=100)


class LearningRoadmapApiResponse(BaseModel):
    success: bool
    data: Any
    message: Optional[str] = None