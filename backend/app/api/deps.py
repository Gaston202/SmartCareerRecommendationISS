"""Dependencies for API endpoints."""
import logging
from app.core.supabase import supabase as supabase_client

logger = logging.getLogger(__name__)

_services = {}


def get_auth_service():
    """Get auth service instance."""
    from app.modules.auth.service import AuthService
    if "auth" not in _services:
        _services["auth"] = AuthService(supabase_client)
    return _services["auth"]


async def get_cv_service():
    """Get CV service instance."""
    from app.modules.cv.service import CvService
    from app.core.database import DatabaseService
    from app.core.ai_orchestrator import AIOrchestratorService
    from app.core.cache import CacheService
    
    if "cv" not in _services:
        db = await DatabaseService.create()
        ai = AIOrchestratorService()
        cache = CacheService()
        _services["cv"] = CvService(db, ai, cache)
    return _services["cv"]


async def get_quiz_service():
    """Get Quiz service instance."""
    from app.modules.quiz.service import QuizService
    from app.modules.career.service import CareerService
    from app.core.database import DatabaseService
    from app.core.ai_orchestrator import AIOrchestratorService
    from app.core.cache import CacheService
    
    if "quiz" not in _services:
        db = await DatabaseService.create()
        ai = AIOrchestratorService()
        cache = CacheService()
        career = CareerService(db, ai, cache)
        _services["quiz"] = QuizService(db, ai, cache, career)
    return _services["quiz"]


async def get_career_service():
    """Get Career service instance."""
    from app.modules.career.service import CareerService
    from app.core.database import DatabaseService
    from app.core.ai_orchestrator import AIOrchestratorService
    from app.core.cache import CacheService
    
    if "career" not in _services:
        db = await DatabaseService.create()
        ai = AIOrchestratorService()
        cache = CacheService()
        _services["career"] = CareerService(db, ai, cache)
    return _services["career"]