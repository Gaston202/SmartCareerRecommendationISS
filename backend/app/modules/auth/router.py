from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any
from app.core.auth import AuthService
from app.core.database import DatabaseService
from app.core.dependencies import get_database_service, get_auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


@router.post("/validate")
async def validate_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    """
    Validate Supabase JWT token.
    Equivalent to NestJS AuthController.validateToken.
    """
    try:
        user_data = await auth_service.validate_user_from_supabase(credentials.credentials)
        return {
            "success": True,
            "data": user_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )


@router.get("/profile")
async def get_profile(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    """
    Get user profile.
    Equivalent to NestJS AuthController.getProfile.
    """
    try:
        user_data = await auth_service.validate_user_from_supabase(credentials.credentials)
        user_id = user_data["id"]
        
        profile = await auth_service.get_user_profile(user_id)
        
        return {
            "success": True,
            "data": profile,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch profile: {str(e)}",
        )


@router.put("/profile")
async def update_profile(
    profile_data: Dict[str, Any],
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    """
    Update user profile.
    Equivalent to NestJS AuthController.updateProfile.
    """
    try:
        user_data = await auth_service.validate_user_from_supabase(credentials.credentials)
        user_id = user_data["id"]
        
        updated = await auth_service.create_or_update_user_profile(user_id, profile_data)
        
        return {
            "success": True,
            "data": updated,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}",
        )


@router.get("/health")
async def auth_health() -> Dict[str, str]:
    """Health check for auth module."""
    return {"module": "auth", "status": "ok"}