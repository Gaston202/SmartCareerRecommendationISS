"""CV endpoints - API controller for CV operations."""
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Header
from typing import Optional
import jwt
import logging
from app.api.schemas.cv import (
    CvUploadResponse,
    CvAnalysisResponse,
    CvStatusResponse,
    CvHealthResponse,
)
from app.api.deps import get_cv_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cv", tags=["cv"])


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
            detail=f"Invalid or expired token: {e}",
        )


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """Upload CV PDF for analysis."""
    try:
        user_id = get_user_id_from_token(authorization)
        cv_service = await get_cv_service()
        result = await cv_service.upload_cv(user_id, file)

        return {
            "success": True,
            "data": {
                "analysisId": result.get("id"),
                "status": result.get("status"),
                "message": result.get("message"),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"CV upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload CV: {str(e)}",
        )


@router.delete("/{upload_id}")
async def delete_cv(
    upload_id: str,
    authorization: Optional[str] = Header(None),
):
    """Delete CV upload and all associated data."""
    try:
        user_id = get_user_id_from_token(authorization)
        cv_service = await get_cv_service()
        result = await cv_service.delete_cv(user_id, upload_id)

        return {
            "success": True,
            "data": result,
            "message": "CV deleted successfully",
        }
    except Exception as e:
        logger.error(f"Delete CV failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete CV: {str(e)}",
        )


@router.get("/result/latest")
async def get_latest_result(
    authorization: Optional[str] = Header(None),
):
    """Get latest CV analysis for user."""
    try:
        user_id = get_user_id_from_token(authorization)
        cv_service = await get_cv_service()
        analysis = await cv_service.get_latest_analysis(user_id)

        if not analysis:
            return {"success": True, "data": None, "message": "No CV analysis found"}

        return {"success": True, "data": analysis}
    except Exception as e:
        logger.error(f"Get latest result failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch CV analysis: {str(e)}",
        )


@router.get("/result/{analysis_id}")
async def get_result(
    analysis_id: str,
    authorization: Optional[str] = Header(None),
):
    """Get CV analysis result by ID."""
    try:
        user_id = get_user_id_from_token(authorization)
        cv_service = await get_cv_service()
        analysis = await cv_service.get_analysis(user_id, analysis_id)

        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CV analysis not found",
            )

        return {"success": True, "data": analysis}
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
):
    """Get CV analysis processing status."""
    try:
        user_id = get_user_id_from_token(authorization)
        cv_service = await get_cv_service()
        analysis = await cv_service.get_analysis(user_id, analysis_id)

        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CV analysis not found",
            )

        status_map = {"pending": 10, "processing": 50, "completed": 100, "failed": 0}

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


@router.get("/health", response_model=CvHealthResponse)
async def cv_health() -> CvHealthResponse:
    """Health check for CV module."""
    return CvHealthResponse()