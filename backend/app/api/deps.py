"""Dependencies for API endpoints."""
import asyncio
import logging
from typing import Optional

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

_services = {}
_services_lock = asyncio.Lock()


async def _get_or_create(key: str, factory):
    """Thread-safe singleton factory."""
    if key in _services:
        return _services[key]
    async with _services_lock:
        if key not in _services:
            _services[key] = await factory()
    return _services[key]


async def get_user_id_from_token(authorization: Optional[str]) -> str:
    """
    Shared auth helper used by all endpoint routers.
    Validates the Supabase JWT via the Supabase API and returns the user UUID.
    Raises HTTP 401 for any invalid / missing token.
    """
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header format")

    token = parts[1]
    try:
        from app.core.database import DatabaseService
        db = await DatabaseService.create()
        response = await db.get_anon_client().auth.get_user(token)

        error = getattr(response, "error", None)
        if error:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

        user = getattr(response, "user", None)
        if user is None:
            data = getattr(response, "data", None)
            if data:
                user = getattr(data, "user", None)

        if not user or not getattr(user, "id", None):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

        return user.id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not authenticate user")


async def get_auth_service():
    """Get auth service instance."""
    async def _factory():
        from app.modules.auth.service import AuthService
        from app.core.database import DatabaseService
        db = await DatabaseService.create()
        return AuthService(db)
    return await _get_or_create("auth", _factory)


async def get_cv_service():
    """Get CV service instance."""
    async def _factory():
        from app.modules.cv.service import CvService
        from app.core.database import DatabaseService
        from app.core.ai_orchestrator import AIOrchestratorService
        from app.core.cache import CacheService
        db = await DatabaseService.create()
        return CvService(db, AIOrchestratorService(), CacheService())
    return await _get_or_create("cv", _factory)


async def get_quiz_service():
    """Get Quiz service instance."""
    async def _factory():
        from app.modules.quiz.service import QuizService
        from app.modules.career.service import CareerService
        from app.core.database import DatabaseService
        from app.core.ai_orchestrator import AIOrchestratorService
        from app.core.cache import CacheService
        db = await DatabaseService.create()
        ai = AIOrchestratorService()
        cache = CacheService()
        return QuizService(db, ai, cache, CareerService(db, ai, cache))
    return await _get_or_create("quiz", _factory)


async def get_career_service():
    """Get Career service instance."""
    async def _factory():
        from app.modules.career.service import CareerService
        from app.core.database import DatabaseService
        from app.core.ai_orchestrator import AIOrchestratorService
        from app.core.cache import CacheService
        db = await DatabaseService.create()
        return CareerService(db, AIOrchestratorService(), CacheService())
    return await _get_or_create("career", _factory)