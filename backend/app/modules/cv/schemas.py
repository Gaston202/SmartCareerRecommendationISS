from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime


class CvAnalysisBase(BaseModel):
    user_id: str
    status: str  # 'pending' | 'processing' | 'completed' | 'failed'
    extracted_skills: List[str] = []
    extracted_interests: List[str] = []
    summary: str = ""
    error_message: Optional[str] = None


class CvAnalysisResponse(CvAnalysisBase):
    id: str
    original_filename: str
    file_size: int
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CvAnalysisStatus(BaseModel):
    id: str
    status: str
    progress: int = Field(..., ge=0, le=100)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    error_message: Optional[str] = None


class CvSuggestions(BaseModel):
    ats_issues: List[str] = []
    suggested_improvements: List[str] = []


class CvAnalysisResult(BaseModel):
    skills: List[str] = []
    experience: List[dict] = []
    education: List[dict] = []
    summary: str = ""