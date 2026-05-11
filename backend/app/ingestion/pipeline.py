import logging
from datetime import datetime, timezone

from app.core.cache import CacheService
from app.core.database import DatabaseService
from app.ingestion.chunker import chunk_text
from app.ingestion.dedup import has_embedding_duplicate
from app.ingestion.embedder import Embedder
from app.ingestion.normalizer import normalize_resource
from app.ingestion.providers import get_provider
from app.ingestion.store import ResourceStore

logger = logging.getLogger(__name__)


async def run_ingestion(job_id: str) -> dict:
    db = await DatabaseService.create()
    cache = CacheService()
    store = ResourceStore(db)
    embedder = Embedder()

    job = await _load_job(db, job_id)
    await _update_job(db, job_id, {"status": "running", "started_at": _now()})

    try:
        provider = get_provider(job.get("provider") or "web")
        raw_items = await provider.fetch(job.get("filters") or {})
        stored_count = 0
        skipped_count = 0

        for raw in raw_items:
            resource = normalize_resource(raw)

            chunks = chunk_text(resource.content)
            embeddings = await embedder.embed_texts([chunk["chunk_text"] for chunk in chunks])
            for chunk, embedding in zip(chunks, embeddings):
                chunk["embedding"] = embedding

            first_embedding = embeddings[0] if embeddings else []
            if await has_embedding_duplicate(db, first_embedding):
                skipped_count += 1
                continue

            await store.upsert_resource_with_chunks(resource, chunks)
            stored_count += 1

        await _update_job(
            db,
            job_id,
            {
                "status": "completed",
                "finished_at": _now(),
                "stats": {
                    "stored_count": stored_count,
                    "skipped_count": skipped_count,
                },
            },
        )
        await _invalidate_roadmap_cache(cache, job)
        return {"job_id": job_id, "stored_count": stored_count, "skipped_count": skipped_count}
    except Exception as exc:
        logger.exception("Ingestion job %s failed", job_id)
        await _update_job(
            db,
            job_id,
            {
                "status": "failed",
                "error_message": str(exc),
                "finished_at": _now(),
            },
        )
        raise


async def _load_job(db: DatabaseService, job_id: str) -> dict:
    result = (
        await db.get_client()
        .from_("ingestion_jobs")
        .select("*")
        .eq("id", job_id)
        .single()
        .execute()
    )
    return result.data or {}


async def _update_job(db: DatabaseService, job_id: str, values: dict) -> None:
    await db.get_client().from_("ingestion_jobs").update(values).eq("id", job_id).execute()


async def _invalidate_roadmap_cache(cache: CacheService, job: dict) -> None:
    filters = job.get("filters") or {}
    skills = filters.get("skill_tags") or []
    removed = await cache.invalidate_pattern("roadmap:rag:*")
    logger.info(
        "Invalidated %s roadmap RAG cache entries after ingestion provider=%s skills=%s",
        removed,
        job.get("provider"),
        skills,
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
