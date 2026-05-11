from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any
from enum import Enum


class Intent(str, Enum):
    BOOKING = "booking"
    SEARCH = "search"
    GENERAL = "general"
    CONFIRMATION = "confirmation"
    UNKNOWN = "unknown"
    GREETING = "greeting"
    HELP = "help"
    CAREER_INFO = "career_info"
    USER_SESSIONS = "user_sessions"
    EXPLAIN_FEATURE = "explain_feature"


class BookingStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AvailabilityCheck(BaseModel):
    mentor_id: Optional[str] = None
    date: str = Field(description="Date in YYYY-MM-DD format")
    duration_minutes: int = Field(default=30, description="Session duration")


class BookingRequest(BaseModel):
    mentor_id: str = Field(description="Mentor UUID")
    user_id: str = Field(description="User UUID")
    date: str = Field(description="Date in YYYY-MM-DD format")
    time: str = Field(description="Time in HH:MM format (24-hour)")
    title: str = Field(default="Mentor Session")
    description: Optional[str] = None
    duration_minutes: int = Field(default=30)


class AvailabilitySlot(BaseModel):
    mentor_id: str
    mentor_name: str
    start_time: str
    end_time: str
    is_available: bool = True


class BookingResponse(BaseModel):
    success: bool
    session_id: Optional[str] = None
    message: str
    scheduled_at: Optional[datetime] = None


class WebSearchResult(BaseModel):
    title: str
    url: str
    snippet: str


class ChatMessage(BaseModel):
    role: str = Field(description="Message role: user, assistant, or tool")
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    tool_name: Optional[str] = None


class ChatResponse(BaseModel):
    message: str = Field(description="The chatbot's response message")
    action_taken: Optional[str] = Field(default=None, description="Action that was taken, if any")
    data: Optional[dict] = Field(default=None, description="Additional data payload")
    intent: Intent = Field(default=Intent.UNKNOWN, description="Detected user intent")
    session_id: Optional[str] = Field(default=None, description="Booking session ID if booked")


class BookingContext(BaseModel):
    mentor_id: Optional[str] = None
    mentor_name: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    duration_minutes: int = 30
    slots: list[AvailabilitySlot] = []
    confirmed: bool = False
    stage: str = "clarification"
    attempts: int = 0
    session_id: Optional[str] = None


class SearchContext(BaseModel):
    query: Optional[str] = None
    results: list[WebSearchResult] = []
    topic: Optional[str] = None


class UserContext(BaseModel):
    user_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    upcoming_sessions: list[dict] = []


class RouteDecision(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0, le=1)
    reasoning: str = ""