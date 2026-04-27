from fastapi import APIRouter
from app.api.endpoints import auth_router, cv_router, quiz_router, career_router
from app.modules.roadmap.router import router as roadmap_router
from app.modules.learning_roadmap.router import router as learning_roadmap_router

api_router = APIRouter()

# New MVC endpoints (replace legacy modules/)
api_router.include_router(auth_router)
api_router.include_router(quiz_router)
api_router.include_router(career_router)
api_router.include_router(cv_router)

# Legacy modules (still working)
api_router.include_router(roadmap_router)
api_router.include_router(learning_roadmap_router)
