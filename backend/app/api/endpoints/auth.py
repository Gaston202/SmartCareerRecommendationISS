"""Auth endpoints - API controller for authentication."""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.api.schemas.auth import (
    TokenValidationResponse,
    UserProfileRequest,
    UserProfileResponse,
    AuthHealthResponse,
)
from app.api.deps import get_auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


@router.post("/validate", response_model=dict)
async def validate_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validate Supabase JWT token.
    """
    try:
        auth_service = get_auth_service()
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


@router.get("/profile", response_model=dict)
async def get_profile(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Get user profile.
    """
    try:
        auth_service = get_auth_service()
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


@router.put("/profile", response_model=dict)
async def update_profile(
    profile_data: UserProfileRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Update user profile.
    """
    try:
        auth_service = get_auth_service()
        user_data = await auth_service.validate_user_from_supabase(credentials.credentials)
        user_id = user_data["id"]

        updated = await auth_service.create_or_update_user_profile(user_id, profile_data.model_dump(exclude_unset=True))

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


@router.get("/health", response_model=AuthHealthResponse)
async def auth_health() -> AuthHealthResponse:
    """Health check for auth module."""
    return AuthHealthResponse()