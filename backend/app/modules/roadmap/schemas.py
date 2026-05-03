from pydantic import BaseModel, Field
from typing import List, Optional, Any, Literal
from datetime import datetime


class RoadmapTask(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    estimated_hours: int = Field(..., ge=0)
    dependencies: List[str] = []


class RoadmapResource(BaseModel):
    id: str
    type: str  # 'course' | 'book' | 'article' | 'tool' | 'certification'
    title: str
    url: Optional[str] = None
    description: Optional[str] = None


class RoadmapMilestone(BaseModel):
    id: str
    title: str
    description: str
    duration_weeks: int = Field(..., ge=0)
    tasks: List[RoadmapTask] = []
    resources: List[RoadmapResource] = []


class RoadmapBase(BaseModel):
    id: str
    user_id: str
    career_id: str
    title: str
    description: str
    milestones: List[RoadmapMilestone] = []
    total_duration_weeks: int = Field(..., ge=0)
    created_at: datetime


class RoadmapResponse(RoadmapBase):
    class Config:
        from_attributes = True


class GenerateRoadmapRequest(BaseModel):
    career_id: str
    use_async: bool = False
    user_profile: Optional[dict] = None


class RoadmapJobStatus(BaseModel):
    id: str
    name: str
    status: str
    progress: int = Field(..., ge=0, le=100)
    data: Optional[dict] = None


# ========== Roadmap Plan (RAG) Schemas ==========


RoadmapLevel = Literal["beginner", "intermediate", "advanced"]


class RoadmapResourceFilters(BaseModel):
    level: Optional[RoadmapLevel] = None
    free_or_paid: Optional[str] = None
    language: Optional[str] = None
    duration_max: Optional[int] = None
    duration_min: Optional[int] = None
    resource_type: Optional[str] = None
    certificate: Optional[bool] = None
    provider: Optional[str] = None
    target_role: Optional[str] = None
    skill_tags: Optional[List[str]] = None


class RoadmapUserPreferences(BaseModel):
    language: Optional[str] = None
    budget: Optional[str] = None
    time_per_week_hours: Optional[int] = None


class RoadmapSequenceConstraint(BaseModel):
    before: str
    after: str


class PlanRoadmapRequest(BaseModel):
    career_id: Optional[str] = None
    target_role: Optional[str] = None
    user_skills: Optional[List[str]] = None
    max_steps: Optional[int] = 8
    filters: Optional[RoadmapResourceFilters] = None
    sequence_constraints: Optional[List[RoadmapSequenceConstraint]] = None
    user_profile: Optional[dict] = None


class RoadmapStep(BaseModel):
    skill_name: str
    why_it_matters: str
    difficulty: RoadmapLevel
    estimated_duration_hours: int
    prerequisites: List[str] = []
    resource_id: Optional[str] = None
    resource_title: Optional[str] = None
    resource_type: Optional[str] = None
    free_or_paid: Optional[str] = None
    language: Optional[str] = None
    level: Optional[RoadmapLevel] = None
    provider: Optional[str] = None
    source_url: Optional[str] = None
    confidence_score: float
    order_index: int
    primary_resource: Optional[dict] = None
    backup_resources: Optional[List[dict]] = None
    evidence_reasons: Optional[List[str]] = None


class PlannedRoadmapResponse(BaseModel):
    success: bool = True
    mode: str = "stored_kb_v1"
    target_role: str
    career_id: Optional[str] = None
    confidence: float
    weak_evidence: bool
    message: Optional[str] = None
    steps: List[RoadmapStep]
    diagnostics: Optional[dict] = None
    metadata: Optional[dict] = None


class SkillGap(BaseModel):
    skill_name: str
    canonical_name: str
    difficulty: RoadmapLevel = "beginner"
    estimated_duration_hours: int = 18
    prerequisites: List[str] = []
    priority: int = 0
    description: Optional[str] = None


class ResourceResult(BaseModel):
    resource_id: str
    title: str
    provider: Optional[str] = None
    source_url: Optional[str] = None
    resource_type: Optional[str] = None
    free_or_paid: Optional[str] = None
    language: Optional[str] = "en"
    level: Optional[RoadmapLevel] = None
    keyword_score: float = 0.0
    vector_score: float = 0.0
    final_score: float = 0.0
    matched_skill_tags: List[str] = []
    chunk_text: Optional[str] = None


class EvidenceResource(BaseModel):
    resource_id: str
    title: str
    provider: Optional[str] = None
    source_url: Optional[str] = None
    score: float
    why_selected: str
    display_badges: Optional[List[str]] = None
    recommendation_reason: Optional[str] = None


class EvidenceResult(BaseModel):
    skill: str
    primary_resource: Optional[EvidenceResource] = None
    backup_resources: List[EvidenceResource] = []
    score: float = 0.0
    confidence: Literal["high", "medium", "low"] = "low"
    needs_web_fallback: bool = False
    reasons: List[str] = []


class SearchResourcesRequest(BaseModel):
    query: str
    top_k: int = 5
    filters: Optional[RoadmapResourceFilters] = None


class SearchResourcesResponse(BaseModel):
    success: bool = True
    resources: List[ResourceResult]
    confidence: float
    weak_evidence: bool


class RefreshProviderRequest(BaseModel):
    provider: str
    url: Optional[str] = None
    urls: Optional[List[str]] = None
    mode: str = "on_demand_refresh"
    reason: Optional[str] = None
    filters: Optional[dict] = None


class RefreshProviderResponse(BaseModel):
    success: bool = True
    data: dict
    message: str = "Refresh request queued"


class ResourceSchema(BaseModel):
    provider: str
    provider_resource_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    source_url: str
    resource_type: str = "article"
    language: str = "en"
    level: Optional[RoadmapLevel] = None
    free_or_paid: str = "free"
    duration_hours: Optional[int] = None
    certificate: bool = False
    skill_tags: List[str] = []
    target_roles: List[str] = []
    content: str = ""
    metadata: dict = {}
