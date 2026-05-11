"""CV endpoints - API controller for CV operations."""
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Header
from typing import Optional
import logging
from app.api.schemas.cv import (
    CvUploadResponse,
    CvAnalysisResponse,
    CvStatusResponse,
    CvHealthResponse,
)
from app.api.deps import get_cv_service, get_user_id_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cv", tags=["cv"])

_MAX_CV_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_MIME_TYPES = {"application/pdf"}


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """Upload CV PDF for analysis."""
    # Validate content type before reading the file body
    if file.content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted",
        )

    # Validate file size (read fully into memory once; service can reuse)
    content = await file.read()
    if len(content) > _MAX_CV_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CV file must be smaller than {_MAX_CV_SIZE_BYTES // (1024*1024)} MB",
        )

    # Sanitise filename — strip path separators to prevent storage-path traversal
    import os
    safe_filename = os.path.basename(file.filename or "upload.pdf").replace("..", "")
    file.filename = safe_filename

    # Reset stream so the service can read from the beginning
    import io
    file.file = io.BytesIO(content)

    try:
        user_id = await get_user_id_from_token(authorization)
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
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"CV upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload CV",
        )


@router.delete("/{upload_id}")
async def delete_cv(
    upload_id: str,
    authorization: Optional[str] = Header(None),
):
    """Delete CV upload and all associated data."""
    try:
        user_id = await get_user_id_from_token(authorization)
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
            detail="Failed to delete CV",
        )


@router.get("/result/latest")
async def get_latest_result(
    authorization: Optional[str] = Header(None),
):
    """Get latest CV analysis for user."""
    try:
        user_id = await get_user_id_from_token(authorization)
        cv_service = await get_cv_service()
        analysis = await cv_service.get_latest_analysis(user_id)

        if not analysis:
            return {"success": True, "data": None, "message": "No CV analysis found"}

        return {"success": True, "data": analysis}
    except Exception as e:
        logger.error(f"Get latest result failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch CV analysis",
        )


@router.get("/result/{analysis_id}")
async def get_result(
    analysis_id: str,
    authorization: Optional[str] = Header(None),
):
    """Get CV analysis result by ID."""
    try:
        user_id = await get_user_id_from_token(authorization)
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
            detail="Failed to fetch CV analysis",
        )


@router.get("/status/{analysis_id}")
async def get_status(
    analysis_id: str,
    authorization: Optional[str] = Header(None),
):
    """Get CV analysis processing status."""
    try:
        user_id = await get_user_id_from_token(authorization)
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
            detail="Failed to get CV status",
        )


@router.get("/health", response_model=CvHealthResponse)
async def cv_health() -> CvHealthResponse:
    """Health check for CV module."""
    return CvHealthResponse()