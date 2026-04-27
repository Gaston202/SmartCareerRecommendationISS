from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.auth import AuthService
from app.core.database import DatabaseService
from app.core.cache import CacheService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.queue import QueueService

# Security scheme
security = HTTPBearer()

# Service instances (could be rewritten as providers for dependency injection)
# For simplicity, we create singleton-like services here.
# In a larger app, you might use dependency injection containers or providers.

_db_service: DatabaseService | None = None

async def get_database_service() -> DatabaseService:
    """Get database service instance."""
    global _db_service
    if _db_service is None:
        _db_service = await DatabaseService.create()
    return _db_service

def get_cache_service() -> CacheService:
    """Get cache service instance."""
    return CacheService()

def get_ai_orchestrator_service() -> AIOrchestratorService:
    """Get AI orchestrator service instance."""
    return AIOrchestratorService()

def get_queue_service() -> QueueService:
    """Get queue service instance."""
    return QueueService()

def get_auth_service(db: DatabaseService = Depends(get_database_service)) -> AuthService:
    """Get auth service instance."""
    return AuthService(db)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> dict:
    """
    Dependency to get the current user from the Supabase JWT token.
    Equivalent to NestJS JwtAuthGuard.
    """
    token = credentials.credentials
    try:
        user_data = await auth_service.validate_user_from_supabase(token)
        return user_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from e