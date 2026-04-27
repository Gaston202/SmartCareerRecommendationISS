from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from app.modules.roadmap.service import RoadmapService
from app.modules.roadmap.schemas import (
    GenerateRoadmapRequest,
    PlanRoadmapRequest,
    PlannedRoadmapResponse,
)
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.queue import QueueService
from app.core.cache import CacheService
from app.core.dependencies import (
    get_database_service,
    get_ai_orchestrator_service,
    get_queue_service,
    get_cache_service,
)
from app.core.auth import AuthService

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


async def get_roadmap_service(
    db: DatabaseService = Depends(get_database_service),
    ai: AIOrchestratorService = Depends(get_ai_orchestrator_service),
    queue: QueueService = Depends(get_queue_service),
    cache: CacheService = Depends(get_cache_service),
) -> RoadmapService:
    """Dependency to get RoadmapService instance."""
    return RoadmapService(db, ai, queue, cache)


@router.post("/generate")
async def generate_roadmap(
    request: GenerateRoadmapRequest,
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> Dict[str, Any]:
    """
    Generate a personalized career roadmap.
    Equivalent to NestJS RoadmapController.generateRoadmap.
    """
    try:
        # Note: user_id should come from auth
        user_id = "test-user"  # Should come from auth dependency
        
        if request.use_async:
            result = await roadmap_service.generate_roadmap_async(
                user_id,
                request.career_id,
                request.user_profile,
            )
            return {
                "success": True,
                "data": result,
                "message": "Roadmap generation queued",
            }
        else:
            roadmap = await roadmap_service.get_or_generate_roadmap(
                user_id,
                request.career_id,
                request.user_profile,
            )
            return {
                "success": True,
                "data": roadmap,
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate roadmap: {str(e)}",
        )


@router.post("/plan")
async def plan_roadmap(
    request: PlanRoadmapRequest,
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> PlannedRoadmapResponse:
    """
    Generate a modular hybrid-RAG learning roadmap plan.
    Equivalent to NestJS RoadmapController.planRoadmap.
    """
    try:
        # Note: user_id should come from auth
        user_id = "test-user"  # Should come from auth dependency
        
        # For now, use the legacy roadmap as fallback since RAG planner is not yet implemented
        # This returns a basic plan based on the career template
        roadmap = await roadmap_service.get_or_generate_roadmap(
            user_id,
            request.career_id or "",
            request.user_profile,
        )
        
        # Convert roadmap to planned response format
        steps = []
        for idx, milestone in enumerate(roadmap.get("milestones", [])):
            for task in milestone.get("tasks", []):
                steps.append({
                    "skill_name": task.get("title", "Skill"),
                    "why_it_matters": task.get("description", "This skill is important for this career path."),
                    "difficulty": "intermediate",
                    "estimated_duration_hours": task.get("estimated_hours", 20),
                    "prerequisites": task.get("dependencies", []),
                    "resource_id": None,
                    "resource_title": None,
                    "resource_type": None,
                    "free_or_paid": None,
                    "language": None,
                    "level": None,
                    "provider": None,
                    "source_url": None,
                    "confidence_score": 0.7,
                    "order_index": idx,
                    "primary_resource": None,
                    "backup_resources": [],
                    "evidence_reasons": ["Based on career roadmap template"],
                })
        
        # If no steps from template, create a basic plan
        if not steps:
            steps = [{
                "skill_name": "Introduction to Career",
                "why_it_matters": "Foundational knowledge for starting this career path.",
                "difficulty": "beginner",
                "estimated_duration_hours": 20,
                "prerequisites": [],
                "resource_id": None,
                "resource_title": None,
                "resource_type": None,
                "free_or_paid": None,
                "language": None,
                "level": None,
                "provider": None,
                "source_url": None,
                "confidence_score": 0.5,
                "order_index": 0,
                "primary_resource": None,
                "backup_resources": [],
                "evidence_reasons": ["Basic career introduction"],
            }]
        
        return PlannedRoadmapResponse(
            success=True,
            mode="stored_kb_v1",
            target_role=request.target_role or roadmap.get("title", "Career"),
            career_id=request.career_id,
            confidence=0.7,
            weak_evidence=True,
            message="insufficient reliable sources for some steps",
            steps=steps,
            diagnostics={
                "totalCandidates": len(steps),
                "poolSize": len(steps),
                "coverageBySkill": {step["skill_name"]: step["confidence_score"] for step in steps},
            },
            metadata={
                "required_skills": [],
                "existing_skills": request.user_profile.get("skills", []) if request.user_profile else [],
                "missing_skills": [step["skill_name"] for step in steps],
                "evidence_summary": {
                    "strong_steps": 0,
                    "weak_steps": len(steps),
                    "source_count": 0,
                },
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate roadmap plan: {str(e)}",
        )


@router.get("/career/{career_id}")
async def get_roadmap(
    career_id: str,
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> Dict[str, Any]:
    """
    Get roadmap for a specific career.
    Equivalent to NestJS RoadmapController.getRoadmap.
    """
    try:
        user_id = "test-user"  # Should come from auth dependency
        roadmap = await roadmap_service.get_or_generate_roadmap(user_id, career_id)
        return {
            "success": True,
            "data": roadmap,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get roadmap: {str(e)}",
        )


@router.get("/status/{job_id}")
async def get_job_status(
    job_id: str,
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> Dict[str, Any]:
    """
    Check async roadmap generation job status.
    Equivalent to NestJS RoadmapController.getJobStatus.
    """
    try:
        status = await roadmap_service.get_roadmap_job_status(job_id)
        return {
            "success": True,
            "data": status,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}",
        )


@router.get("/health")
async def roadmap_health() -> Dict[str, str]:
    """Health check for roadmap module."""
    return {"module": "roadmap", "status": "ok"}