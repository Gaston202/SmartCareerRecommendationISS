from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Header
from typing import Dict, Any, Optional
from app.modules.cv.service import CvService
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.dependencies import (
    get_database_service,
    get_ai_orchestrator_service,
    get_cache_service,
)
import jwt
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cv", tags=["cv"])


async def get_cv_service(
    db: DatabaseService = Depends(get_database_service),
    ai: AIOrchestratorService = Depends(get_ai_orchestrator_service),
    cache: CacheService = Depends(get_cache_service),
) -> CvService:
    """Dependency to get CvService instance."""
    return CvService(db, ai, cache)


def get_user_id_from_token(authorization: Optional[str] = None) -> str:
    """Extract user ID from JWT token."""
    if not authorization:
        logger.warning("get_user_id_from_token: Missing authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )

    try:
        # Extract token from "Bearer <token>"
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            logger.warning(f"get_user_id_from_token: Invalid format: {parts}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
            )

        token = parts[1]

        # Decode JWT without verification (Supabase client has already verified it)
        try:
            # Try to decode without verification to get the payload
            payload = jwt.decode(token, options={"verify_signature": False})
            logger.debug("get_user_id_from_token: JWT decoded successfully")
            user_id = payload.get("sub")  # Supabase stores user ID in 'sub' claim
            if not user_id:
                logger.warning("get_user_id_from_token: No 'sub' claim in JWT")
                raise ValueError("No user ID in token")
            return user_id
        except Exception as e:
            logger.warning(f"Failed to decode JWT: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token extraction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not authenticate user",
        )


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    cv_service: CvService = Depends(get_cv_service),
) -> Dict[str, Any]:
    """
    Upload CV PDF for analysis.
    Equivalent to NestJS CvController.uploadCv.
    """
    try:
        # Extract user_id from auth token
        user_id = get_user_id_from_token(authorization)

        result = await cv_service.upload_cv(user_id, file)
        # Map backend 'id' to 'analysisId' for mobile app compatibility
        return {
            "success": True,
            "data": {
                "analysisId": result.get("id") if isinstance(result, dict) else None,
                "status": result.get("status") if isinstance(result, dict) else None,
                "message": result.get("message") if isinstance(result, dict) else None,
            },
        }
    except HTTPException:
        raise
    except ValueError as e:
        # Client error (e.g. missing PyPDF2, unreadable/scanned PDF, etc.)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload CV: {str(e)}",
        )


@router.delete("/{upload_id}")
async def delete_cv(
    upload_id: str,
    authorization: Optional[str] = Header(None),
    cv_service: CvService = Depends(get_cv_service),
) -> Dict[str, Any]:
    """
    Delete CV upload and all associated data.
    Deletes cv_analysis records, career_match_results, and storage file.
    """
    try:
        user_id = get_user_id_from_token(authorization)

        result = await cv_service.delete_cv(user_id, upload_id)

        return {
            "success": True,
            "data": result,
            "message": "CV deleted successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"delete_cv: Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete CV: {str(e)}",
        )


@router.get("/result/latest")
async def get_latest_result(
    authorization: Optional[str] = Header(None),
    cv_service: CvService = Depends(get_cv_service),
) -> Dict[str, Any]:
    """
    Get latest CV analysis for user.
    Equivalent to NestJS CvController.getLatestResult.
    """
    try:
        logger.debug("get_latest_result: Processing request")
        user_id = get_user_id_from_token(authorization)
        analysis = await cv_service.get_latest_analysis(user_id)
        logger.debug(f"get_latest_result: analysis_found={analysis is not None}")

        if not analysis:
            return {
                "success": True,
                "data": None,
                "message": "No CV analysis found",
            }

        return {
            "success": True,
            "data": analysis,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_latest_result: Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch CV analysis: {str(e)}",
        )


@router.get("/result/{analysis_id}")
async def get_result(
    analysis_id: str,
    authorization: Optional[str] = Header(None),
    cv_service: CvService = Depends(get_cv_service),
) -> Dict[str, Any]:
    """
    Get CV analysis result by ID.
    Equivalent to NestJS CvController.getResult.
    """
    try:
        user_id = get_user_id_from_token(authorization)
        analysis = await cv_service.get_analysis(user_id, analysis_id)

        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CV analysis not found",
            )

        return {
            "success": True,
            "data": analysis,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch CV analysis: {str(e)}",
        )


@router.get("/status/{analysis_id}")
async def get_status(
    analysis_id: str,
    authorization: Optional[str] = Header(None),
    cv_service: CvService = Depends(get_cv_service),
) -> Dict[str, Any]:
    """
    Get CV analysis processing status.
    Equivalent to NestJS CvController.getStatus.
    """
    try:
        user_id = get_user_id_from_token(authorization)
        analysis = await cv_service.get_analysis(user_id, analysis_id)

        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CV analysis not found",
            )

        status_map = {
            "pending": 10,
            "processing": 50,
            "completed": 100,
            "failed": 0,
        }

        return {
            "success": True,
            "data": {
                "id": analysis["id"],
                "status": analysis["status"],
                "progress": status_map.get(analysis["status"], 0),
                "created_at": analysis.get("created_at"),
                "updated_at": analysis.get("updated_at"),
                "error_message": analysis.get("error_message"),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get CV status: {str(e)}",
        )


@router.get("/health")
async def cv_health() -> Dict[str, str]:
    """Health check for CV module."""
    return {"module": "cv", "status": "ok"}
