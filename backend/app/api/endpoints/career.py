"""Career endpoints - API controller for career operations."""
from fastapi import APIRouter, HTTPException, status, Header
from typing import Optional
import jwt
import logging
from app.api.schemas.career import (
    RecommendCareersRequest,
    CareerListResponse,
    CareerHealthResponse,
)
from app.api.deps import get_career_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/career", tags=["career"])


def get_user_id_from_token(authorization: Optional[str] = None) -> str:
    """Extract user ID from JWT token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )

    token = parts[1]
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No user ID in token")
        return user_id
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not authenticate user: {e}",
        )


@router.post("/recommend")
async def recommend_careers(
    request: RecommendCareersRequest,
    authorization: Optional[str] = Header(None),
):
    """Get personalized career recommendations."""
    try:
        user_id = get_user_id_from_token(authorization)
        career_service = await get_career_service()

        matches = await career_service.get_career_recommendations(
            user_id=user_id,
            quiz_session_id=request.quiz_session_id,
            cv_analysis_id=request.cv_analysis_id,
            nova_profile=request.nova_profile,
        )

        return {"success": True, "data": matches}
    except Exception as e:
        logger.error(f"recommend_careers failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get career recommendations: {str(e)}",
        )


@router.get("/all")
async def get_all_careers():
    """Get all available careers."""
    try:
        career_service = await get_career_service()
        careers = await career_service.get_all_careers()
        return {"success": True, "data": careers}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch careers: {str(e)}",
        )


@router.get("/health", response_model=CareerHealthResponse)
async def career_health() -> CareerHealthResponse:
    """Health check for career module."""
    return CareerHealthResponse()