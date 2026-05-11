import json
import logging
from typing import List

from app.core.database import DatabaseService
from app.ingestion.normalizer import normalize_url
from app.modules.roadmap.schemas import ResourceSchema

logger = logging.getLogger(__name__)


async def is_duplicate_url(db: DatabaseService, resource: ResourceSchema) -> bool:
    result = (
        await db.get_client()
        .from_("resources")
        .select("id")
        .eq("source_url_normalized", normalize_url(resource.source_url))
        .limit(1)
        .execute()
    )
    return bool(result.data)


async def has_embedding_duplicate(
    db: DatabaseService,
    embedding: List[float],
    threshold: float = 0.97,
) -> bool:
    """Use pgvector ANN search instead of a Python-loop over arbitrary rows."""
    if not embedding:
        return False

    try:
        # cosine distance = 1 - cosine_similarity, so similarity >= threshold
        # means distance <= (1 - threshold)
        max_distance = 1.0 - threshold
        vector_literal = json.dumps(embedding)

        result = await db.get_client().rpc(
            "embedding_duplicate_check",
            {"query_embedding": vector_literal, "max_distance": max_distance},
        ).execute()

        return bool(result.data)
    except Exception as e:
        # Graceful fallback: if the RPC doesn't exist yet, skip dedup rather than crash ingestion
        logger.warning("has_embedding_duplicate RPC failed (%s), skipping dedup", e)
        return False
