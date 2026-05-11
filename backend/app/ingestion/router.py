from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.database import DatabaseService
from app.core.dependencies import get_database_service, get_queue_service
from app.core.queue import QueueService
from app.ingestion.normalizer import normalize_url
from app.api.deps import get_user_id_from_token

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.get("/status/{job_id}")
async def get_ingestion_status(
    job_id: str,
    authorization: Optional[str] = Header(None),
    db: DatabaseService = Depends(get_database_service),
    queue: QueueService = Depends(get_queue_service),
) -> Dict[str, Any]:
    await get_user_id_from_token(authorization)
    """Return ingestion job status for frontend polling."""
    try:
        result = (
            await db.get_client()
            .from_("ingestion_jobs")
            .select("*")
            .eq("id", job_id)
            .single()
            .execute()
        )
        job = result.data or {}
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ingestion job not found",
            )

        queue_state = await queue.get_job_status(job_id)
        if queue_state and queue_state.get("status") == "unknown":
            queue_state = None
        stats = job.get("stats") or {}
        outcome = _derive_outcome(job.get("status"), stats)
        stored_resource = await _find_stored_resource(db, job) if outcome in {"completed", "partial_success", "no_changes"} else None

        return {
            "success": True,
            "data": {
                "id": job.get("id"),
                "provider": job.get("provider"),
                "job_type": job.get("job_type"),
                "status": job.get("status"),
                "outcome": outcome,
                "stats": stats,
                "filters": job.get("filters") or {},
                "error_message": job.get("error_message"),
                "started_at": job.get("started_at"),
                "finished_at": job.get("finished_at"),
                "created_at": job.get("created_at"),
                "updated_at": job.get("updated_at"),
                "queue_state": queue_state,
                "stored_resource": stored_resource,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get ingestion job status",
        ) from exc


def _derive_outcome(job_status: str | None, stats: dict) -> str:
    if job_status in {"pending", "running", "failed"}:
        return job_status
    if job_status != "completed":
        return "unknown"

    stored_count = int(stats.get("stored_count") or 0)
    skipped_count = int(stats.get("skipped_count") or 0)
    if stored_count and skipped_count:
        return "partial_success"
    if stored_count:
        return "completed"
    if skipped_count:
        return "no_changes"
    return "completed"


async def _find_stored_resource(db: DatabaseService, job: dict) -> dict[str, Any] | None:
    filters = job.get("filters") or {}
    urls = [url for url in filters.get("urls") or [] if url]
    if not urls:
        return None

    for url in urls:
        normalized_url = normalize_url(url)
        result = (
            await db.get_client()
            .from_("resources")
            .select("id,title,source_url,provider,resource_type")
            .eq("source_url_normalized", normalized_url)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        resource = (result.data or [None])[0]
        if resource:
            return {
                "resource_id": resource.get("id"),
                "title": resource.get("title"),
                "url": resource.get("source_url"),
                "provider": resource.get("provider"),
                "resource_type": resource.get("resource_type"),
            }

    return None
