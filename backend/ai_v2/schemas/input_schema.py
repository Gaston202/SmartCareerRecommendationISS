"""
Input schemas for the AI v2 pipeline.

Defines Pydantic models for validating user input and profile data.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class UserProfile(BaseModel):
    """
    Represents a user's basic profile information.
    
    Attributes:
        user_id (str): Unique identifier for the user
        name (str): User's full name
        email (str): User's email address
        current_skills (List[str]): List of current skills
        experience_level (str): Career experience level (e.g., "entry", "mid", "senior")
        education (Optional[str]): Educational background
    """
    user_id: str = Field(..., description="Unique user identifier")
    name: str = Field(..., description="User's full name")
    email: str = Field(..., description="User's email address")
    current_skills: List[str] = Field(default_factory=list, description="Current skills")
    experience_level: str = Field(default="entry", description="Career experience level")
    education: Optional[str] = Field(default=None, description="Educational background")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "name": "John Doe",
                "email": "john@example.com",
                "current_skills": ["Python", "JavaScript", "SQL"],
                "experience_level": "mid",
                "education": "Bachelor's in Computer Science",
            }
        }


class CareerRecommendationInput(BaseModel):
    """
    Input schema for the career recommendation pipeline.
    
    Attributes:
        user_profile (UserProfile): User's profile data
        cv_text (Optional[str]): Extracted text from user's CV
        job_market_data (Optional[str]): Current job market information
        preferences (Optional[dict]): User's career preferences
    """
    user_profile: UserProfile = Field(..., description="User profile data")
    cv_text: Optional[str] = Field(default=None, description="CV text content")
    job_market_data: Optional[str] = Field(default=None, description="Job market context")
    preferences: Optional[dict] = Field(default=None, description="User career preferences")

    class Config:
        json_schema_extra = {
            "example": {
                "user_profile": {
                    "user_id": "user_123",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "current_skills": ["Python", "JavaScript"],
                    "experience_level": "entry",
                },
                "cv_text": "Software Engineer with 2 years of experience...",
                "job_market_data": "High demand for full-stack engineers...",
                "preferences": {"preferred_roles": ["Backend Engineer", "DevOps"]},
            }
        }
