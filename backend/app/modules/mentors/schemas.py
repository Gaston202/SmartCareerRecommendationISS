from __future__ import annotations
from typing import List, Optional, Literal
from pydantic import BaseModel


class MentorSpecialty(BaseModel):
    id: str
    mentor_id: str
    specialty: str
    is_primary: bool
    created_at: Optional[str] = None


class MentorReview(BaseModel):
    id: str
    mentor_id: str
    reviewer_id: str
    rating: float
    comment: Optional[str] = None
    created_at: Optional[str] = None


class Mentor(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    years_of_experience: int
    company: Optional[str] = None
    role: Optional[str] = None
    rating: float
    total_reviews: int
    is_verified: bool
    status: Literal["active", "inactive", "suspended"]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MentorWithSpecialties(Mentor):
    mentor_specialties: List[MentorSpecialty] = []
    mentor_reviews: List[MentorReview] = []


class MentorAvailabilityRule(BaseModel):
    id: str
    mentor_id: str
    day_of_week: int
    start_time: str
    end_time: str
    created_at: Optional[str] = None


class MentorSession(BaseModel):
    id: str
    mentor_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    scheduled_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Literal["pending", "scheduled", "completed", "cancelled", "no-show"]
    confirmation_status: Literal["pending", "confirmed", "rejected"]
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class GroupChat(BaseModel):
    id: str
    specialty: str
    title: str
    description: Optional[str] = None
    mentor_id: str
    is_moderated: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    mentor: Optional[Mentor] = None


class ChatMessage(BaseModel):
    id: str
    group_chat_id: str
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    message: str
    is_pinned: Optional[bool] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AvailableSlot(BaseModel):
    date: str
    start_time: str
    end_time: str


# Request bodies

class ScheduleSessionRequest(BaseModel):
    mentor_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    scheduled_at: str
    duration_minutes: int = 30


class SubmitReviewRequest(BaseModel):
    mentor_id: str
    reviewer_id: str
    rating: float
    comment: Optional[str] = None


class SendMessageRequest(BaseModel):
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    message: str


class SaveAvailabilityRequest(BaseModel):
    rules: List[AvailabilityRuleInput]


class AvailabilityRuleInput(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str


class PinMessageRequest(BaseModel):
    is_pinned: bool


SaveAvailabilityRequest.model_rebuild()
