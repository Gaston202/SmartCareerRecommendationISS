from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# Request/Response Models
class CvUploadResponse(BaseModel):
    """Response from CV upload."""
    analysisId: str
    status: str
    message: Optional[str] = None


class CvAnalysisResponse(BaseModel):
    """CV analysis result."""
    id: str
    user_id: Optional[str] = None
    cv_upload_id: Optional[str] = None
    status: Optional[str] = None
    extracted_skills: Optional[List[str]] = Field(default_factory=list)
    extracted_interests: Optional[List[str]] = Field(default_factory=list)
    extracted_text: Optional[str] = None
    ats_score: Optional[int] = None
    ats_issues: Optional[List[dict]] = Field(default_factory=list)
    suggested_improvements: Optional[List[dict]] = Field(default_factory=list)
    career_suggestions: Optional[List[dict]] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CvStatusResponse(BaseModel):
    """CV analysis status."""
    id: str
    status: str
    progress: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    error_message: Optional[str] = None


class CvHealthResponse(BaseModel):
    """Health check response."""
    module: str = "cv"
    status: str = "ok"