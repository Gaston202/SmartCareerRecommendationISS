from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from app.modules.learning_roadmap.service import LearningRoadmapService
from app.modules.learning_roadmap.schemas import (
    GenerateLearningRoadmapRequest,
    SaveLearningRoadmapRequest,
    UpdateLearningRoadmapProgressRequest,
)
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.dependencies import (
    get_database_service,
    get_ai_orchestrator_service,
    get_cache_service,
    get_current_user,
)

router = APIRouter(prefix="/learning-roadmap", tags=["learning_roadmap"])


async def get_learning_roadmap_service(
    db: DatabaseService = Depends(get_database_service),
    ai: AIOrchestratorService = Depends(get_ai_orchestrator_service),
    cache: CacheService = Depends(get_cache_service),
) -> LearningRoadmapService:
    """Dependency to get LearningRoadmapService instance."""
    return LearningRoadmapService(db, ai, cache)


@router.post("/generate")
async def generate_learning_roadmap(
    request: GenerateLearningRoadmapRequest,
    roadmap_service: LearningRoadmapService = Depends(get_learning_roadmap_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generate a skill-based learning roadmap.
    Equivalent to NestJS LearningRoadmapController.generateLearningRoadmap.
    """
    try:
        user_id = current_user["id"]
        
        roadmap = await roadmap_service.generate_learning_roadmap(
            user_id,
            request.career_id or request.career_title,
            request.career_title,
            request.career_description or "",
            request.user_profile,
        )
        
        return {
            "success": True,
            "data": roadmap,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate learning roadmap: {str(e)}",
        )


@router.post("/save")
async def save_learning_roadmap(
    request: SaveLearningRoadmapRequest,
    roadmap_service: LearningRoadmapService = Depends(get_learning_roadmap_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Save a learning roadmap.
    Equivalent to NestJS LearningRoadmapController.saveLearningRoadmap.
    """
    try:
        user_id = current_user["id"]
        
        saved = await roadmap_service.save_learning_roadmap(
            user_id,
            request.career_id,
            request.career_title,
            request.roadmap_data,
        )
        
        return {
            "success": True,
            "data": saved,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save learning roadmap: {str(e)}",
        )


@router.get("/list")
async def get_learning_roadmaps(
    roadmap_service: LearningRoadmapService = Depends(get_learning_roadmap_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get all saved learning roadmaps for user.
    Equivalent to NestJS LearningRoadmapController.getLearningRoadmaps.
    """
    try:
        user_id = current_user["id"]
        roadmaps = await roadmap_service.get_user_learning_roadmaps(user_id)
        return {
            "success": True,
            "data": roadmaps,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get learning roadmaps: {str(e)}",
        )


@router.get("/career/{career_id}")
async def get_learning_roadmap_for_career(
    career_id: str,
    roadmap_service: LearningRoadmapService = Depends(get_learning_roadmap_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get learning roadmap for specific career.
    Equivalent to NestJS LearningRoadmapController.getLearningRoadmapForCareer.
    """
    try:
        user_id = current_user["id"]
        roadmap = await roadmap_service.get_user_learning_roadmap_for_career(user_id, career_id)
        if not roadmap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Learning roadmap not found for this career",
            )
        
        return {
            "success": True,
            "data": roadmap,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get learning roadmap: {str(e)}",
        )


@router.get("/skills/career/{career_id}")
async def get_skills_for_career(
    career_id: str,
    roadmap_service: LearningRoadmapService = Depends(get_learning_roadmap_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get all skills for a career.
    Equivalent to NestJS LearningRoadmapController.getSkillsForCareer.
    """
    try:
        skills = await roadmap_service.get_skills_for_career(career_id)
        return {
            "success": True,
            "data": skills,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get skills: {str(e)}",
        )


@router.get("/courses/{skill_id}")
async def get_courses_for_skill(
    skill_id: str,
    roadmap_service: LearningRoadmapService = Depends(get_learning_roadmap_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get courses for a skill.
    Equivalent to NestJS LearningRoadmapController.getCoursesForSkill.
    """
    try:
        courses = await roadmap_service.get_courses_for_skill(skill_id)
        return {
            "success": True,
            "data": courses,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get courses: {str(e)}",
        )


@router.patch("/progress")
async def update_learning_roadmap_progress(
    request: UpdateLearningRoadmapProgressRequest,
    roadmap_service: LearningRoadmapService = Depends(get_learning_roadmap_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Update progress for a specific skill inside a saved learning roadmap."""
    try:
        user_id = current_user["id"]
        updated = await roadmap_service.update_learning_roadmap_progress(
            user_id=user_id,
            roadmap_id=request.roadmap_id,
            skill_id=request.skill_id,
            started=request.started,
            completed_percentage=request.completed_percentage,
        )
        return {
            "success": True,
            "data": updated,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update roadmap progress: {str(e)}",
        )


@router.get("/health")
async def learning_roadmap_health() -> Dict[str, str]:
    """Health check for learning roadmap module."""
    return {"module": "learning_roadmap", "status": "ok"}