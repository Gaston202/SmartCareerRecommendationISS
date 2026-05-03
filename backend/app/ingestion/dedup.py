import math
from typing import List

from app.core.database import DatabaseService
from app.ingestion.normalizer import normalize_url
from app.modules.roadmap.schemas import ResourceSchema


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
    if not embedding:
        return False

    result = (
        await db.get_client()
        .from_("resource_chunks")
        .select("embedding")
        .limit(50)
        .execute()
    )

    for row in result.data or []:
        existing = row.get("embedding")
        if isinstance(existing, list) and cosine_similarity(existing, embedding) >= threshold:
            return True
    return False


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0
    return dot / (left_norm * right_norm)
