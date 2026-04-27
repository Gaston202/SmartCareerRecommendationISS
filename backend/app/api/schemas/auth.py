from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class TokenValidationRequest(BaseModel):
    """Request to validate a JWT token."""
    token: str


class TokenValidationResponse(BaseModel):
    """Response from token validation."""
    id: str
    email: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class UserProfileRequest(BaseModel):
    """Request to update user profile."""
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None


class UserProfileResponse(BaseModel):
    """User profile response."""
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuthHealthResponse(BaseModel):
    """Health check response."""
    module: str = "auth"
    status: str = "ok"