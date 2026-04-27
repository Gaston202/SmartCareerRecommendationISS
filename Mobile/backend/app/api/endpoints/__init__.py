"""API endpoints package."""
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.cv import router as cv_router
from app.api.endpoints.quiz import router as quiz_router
from app.api.endpoints.career import router as career_router

__all__ = ["auth_router", "cv_router", "quiz_router", "career_router"]