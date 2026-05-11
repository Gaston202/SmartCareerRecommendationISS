"""Career endpoints - API controller for career operations."""
from fastapi import APIRouter, HTTPException, status, Header
from typing import Optional
import logging
from app.api.schemas.career import (
    RecommendCareersRequest,
    CareerListResponse,
    CareerHealthResponse,
)
from app.api.deps import get_career_service, get_user_id_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/career", tags=["career"])


@router.post("/recommend")
async def recommend_careers(
    request: RecommendCareersRequest,
    authorization: Optional[str] = Header(None),
):
    """Get personalized career recommendations."""
    try:
        user_id = await get_user_id_from_token(authorization)
        career_service = await get_career_service()

        matches = await career_service.get_career_recommendations(
            user_id=user_id,
            quiz_session_id=request.quiz_session_id,
            cv_analysis_id=request.cv_analysis_id,
            nova_profile=request.nova_profile,
        )

        return {"success": True, "data": matches}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"recommend_careers failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get career recommendations",
        )


@router.get("/all")
async def get_all_careers():
    """Get all available careers."""
    try:
        career_service = await get_career_service()
        careers = await career_service.get_all_careers()
        return {"success": True, "data": careers}
    except Exception as e:
        logger.error(f"get_all_careers failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch careers",
        )


@router.get("/health", response_model=CareerHealthResponse)
async def career_health() -> CareerHealthResponse:
    """Health check for career module."""
    return CareerHealthResponse()