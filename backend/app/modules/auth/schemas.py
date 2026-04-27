from pydantic import BaseModel
from typing import Optional


class UserProfileBase(BaseModel):
    education_level: Optional[str] = None
    field_of_study: Optional[str] = None
    career_goal: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None  # Comma-separated string as in the NestJS version


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfileResponse(UserProfileBase):
    user_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True