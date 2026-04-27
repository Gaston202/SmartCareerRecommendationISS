from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import Dict, Any, Optional
import jwt
import logging
from app.modules.career.service import CareerService
from app.modules.career.schemas import RecommendCareersRequest, CareerMatchResponse
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.dependencies import (
    get_database_service,
    get_ai_orchestrator_service,
    get_cache_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/career", tags=["career"])


def get_user_id_from_token(authorization: Optional[str] = None) -> str:
    """Extract user ID from JWT token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    try:
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
            )
        token = parts[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No user ID in token")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token extraction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not authenticate user",
        )


async def get_career_service(
    db: DatabaseService = Depends(get_database_service),
    ai: AIOrchestratorService = Depends(get_ai_orchestrator_service),
    cache: CacheService = Depends(get_cache_service),
) -> CareerService:
    """Dependency to get CareerService instance."""
    return CareerService(db, ai, cache)


@router.post("/recommend")
async def recommend_careers(
    request: RecommendCareersRequest,
    authorization: Optional[str] = Header(None),
    career_service: CareerService = Depends(get_career_service),
) -> Dict[str, Any]:
    """
    Get personalized career recommendations based on quiz + CV.
    Equivalent to NestJS CareerController.recommendCareers.
    """
    try:
        user_id = get_user_id_from_token(authorization)

        matches = await career_service.get_career_recommendations(
            user_id=user_id,
            quiz_session_id=request.quiz_session_id,
            cv_analysis_id=request.cv_analysis_id,
            nova_profile=request.nova_profile,
        )

        return {
            "success": True,
            "data": matches,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get career recommendations: {str(e)}",
        )


@router.get("/all")
async def get_all_careers(
    career_service: CareerService = Depends(get_career_service),
) -> Dict[str, Any]:
    """
    Get all available careers (reference data).
    Equivalent to NestJS CareerController.getAllCareers.
    """
    try:
        careers = await career_service.get_all_careers()
        return {
            "success": True,
            "data": careers,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch careers: {str(e)}",
        )


@router.get("/health")
async def career_health() -> Dict[str, str]:
    """Health check for career module."""
    return {"module": "career", "status": "ok"}