from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from typing import Dict, Any
from app.modules.roadmap.hybrid_service import HybridRoadmapService
from app.modules.roadmap.schemas import (
    GenerateRoadmapRequest,
    PlanRoadmapRequest,
    PlannedRoadmapResponse,
    RefreshProviderRequest,
    SearchResourcesRequest,
)
from app.modules.roadmap.service import RoadmapService
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


async def get_hybrid_roadmap_service(
    db: DatabaseService = Depends(get_database_service),
    ai: AIOrchestratorService = Depends(get_ai_orchestrator_service),
    cache: CacheService = Depends(get_cache_service),
) -> HybridRoadmapService:
    """Dependency to get HybridRoadmapService instance."""
    return HybridRoadmapService(db, ai, cache)


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
        user_id = None  # Should come from auth dependency when auth is wired in
        
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
    hybrid_service: HybridRoadmapService = Depends(get_hybrid_roadmap_service),
) -> PlannedRoadmapResponse:
    """
    Generate a hybrid-RAG learning roadmap plan.

    Pipeline:
      1. AI generates an ordered skill sequence from career context.
      2. Hybrid RAG (keyword + vector, OpenRouter text-embedding-3-small)
         retrieves stored courses and certifications from resources/resource_chunks.
      3. Evidence scoring picks the best primary + backup resources.
      4. If confidence is low, DuckDuckGo web search fills gaps with real courses.
      5. Returns an enriched roadmap with mode=hybrid_rag_v1.
    """
    try:
        user_profile = request.user_profile or {}
        user_skills = list(
            dict.fromkeys(
                (request.user_skills or [])
                + (user_profile.get("skills") or [])
                + (user_profile.get("declared_skills") or [])
                + (user_profile.get("cv_extracted_skills") or [])
            )
        )
        target_role = request.target_role or user_profile.get("selected_role") or request.career_id or "Career"

        return await hybrid_service.generate_hybrid_roadmap(
            user_skills=user_skills,
            target_role=target_role,
            max_steps=request.max_steps or 8,
            career_title=user_profile.get("career_title") or target_role,
            career_description=user_profile.get("career_description"),
            user_profile=user_profile,
            career_id=request.career_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate roadmap plan: {str(e)}",
        )


@router.post("/resources/search")
async def search_resources(
    request: SearchResourcesRequest,
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> Dict[str, Any]:
    """Hybrid retrieval across roadmap resources."""
    try:
        return await roadmap_service.search_resources(request.query, request.top_k)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search roadmap resources: {str(e)}",
        )


@router.post("/refresh-provider")
async def refresh_provider(
    request: RefreshProviderRequest,
    background_tasks: BackgroundTasks,
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> Dict[str, Any]:
    """Request ingestion refresh for a trusted provider."""
    try:
        user_id = None  # Should come from auth dependency when auth is wired in
        filters = request.filters or {}
        urls = list(filters.get("urls") or [])
        if request.url:
            urls.append(request.url)
        if request.urls:
            urls.extend(request.urls)
        if urls:
            filters["urls"] = list(dict.fromkeys(urls))

        result = await roadmap_service.request_provider_refresh(
            user_id=user_id,
            provider=request.provider,
            mode=request.mode,
            reason=request.reason,
            filters=filters,
        )
        if result.get("id"):
            background_tasks.add_task(run_ingestion, result["id"])
        return {
            "success": True,
            "data": result,
            "message": "Refresh request queued",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue provider refresh: {str(e)}",
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
async def roadmap_health(
    hybrid_service: HybridRoadmapService = Depends(get_hybrid_roadmap_service),
) -> Dict[str, Any]:
    """Health check for roadmap module + embedding status."""
    return {
        "module": "roadmap",
        "status": "ok",
        "primary_embedding_model": hybrid_service.retrieval.embedding_model,
        "fallback_models": hybrid_service.retrieval.embedding_fallbacks,
        "auth_failed_models": sorted(hybrid_service.retrieval._auth_failed_models),
    }
