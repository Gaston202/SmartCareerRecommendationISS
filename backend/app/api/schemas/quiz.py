from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class QuizStartResponse(BaseModel):
    """Response from starting a quiz."""
    sessionId: str
    question: dict
    questionNumber: int
    totalQuestions: int = 10


class QuizAnswerRequest(BaseModel):
    """Request for submitting quiz answer."""
    sessionId: str
    answer: str
    questionNumber: Optional[int] = None
    question: Optional[str] = None
    options: Optional[List[str]] = None


class QuizAnswerResponse(BaseModel):
    """Response from submitting answer."""
    sessionId: str
    question: Optional[dict] = None
    questionNumber: int
    totalQuestions: int
    isComplete: bool = False
    scores: Optional[dict] = None


class QuizResultResponse(BaseModel):
    """Quiz result response."""
    sessionId: str
    discProfile: dict
    scoreSummary: dict
    careerMatches: List[dict] = Field(default_factory=list)


class QuizHistoryItem(BaseModel):
    """Historical quiz result."""
    sessionId: str
    completedAt: datetime
    discProfile: dict
    scoreSummary: dict


class QuizHistoryResponse(BaseModel):
    """Quiz history response."""
    sessions: List[QuizHistoryItem] = Field(default_factory=list)


class QuizHealthResponse(BaseModel):
    """Health check response."""
    module: str = "quiz"
    status: str = "ok"
    debug: str = "NEW-CODE"