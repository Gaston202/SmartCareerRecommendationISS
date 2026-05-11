import logging
from typing import List, Optional

import httpx

from app.core.config import settings
from app.core.database import DatabaseService
from app.modules.roadmap.schemas import ResourceResult

logger = logging.getLogger(__name__)


class RoadmapRetrievalService:
    def __init__(self, db: DatabaseService):
        self.db = db
        self.api_key = settings.openrouter_api_key
        self.embeddings_url = settings.openrouter_embeddings_url
        self.embedding_model = settings.roadmap_embedding_model

    async def search_resources(self, skill: str, top_k: int = 5) -> List[ResourceResult]:
        top_k = max(1, min(top_k, 20))
        keyword_rows = await self._keyword_search(skill, top_k * 4)
        vector_rows = await self._vector_search(skill, top_k * 4)

        by_id: dict[str, ResourceResult] = {}
        for row in keyword_rows:
            by_id[row.resource_id] = row

        for row in vector_rows:
            existing = by_id.get(row.resource_id)
            if existing:
                existing.vector_score = max(existing.vector_score, row.vector_score)
                existing.chunk_text = existing.chunk_text or row.chunk_text
            else:
                by_id[row.resource_id] = row

        results = []
        for result in by_id.values():
            tag_score = self._tag_score(skill, result)
            result.final_score = self._clamp_score(
                0.35 * result.keyword_score + 0.45 * result.vector_score + 0.20 * tag_score
            )
            if tag_score:
                result.final_score = max(result.final_score, 0.72)
            results.append(result)

        return sorted(results, key=lambda item: item.final_score, reverse=True)[:top_k]

    async def _keyword_search(self, skill: str, limit: int) -> List[ResourceResult]:
        try:
            result = await self.db.get_client().rpc(
                "roadmap_keyword_search",
                {
                    "query_text": skill,
                    "limit_count": limit,
                    "filters": {},
                },
            ).execute()
            rows = result.data or []
            return [self._resource_from_keyword_row(row) for row in rows]
        except Exception as exc:
            logger.warning("Keyword RPC failed for %s: %s", skill, exc)
            return await self._keyword_fallback(skill, limit)

    async def _keyword_fallback(self, skill: str, limit: int) -> List[ResourceResult]:
        result = (
            await self.db.get_client()
            .from_("resources")
            .select("id,title,provider,source_url,resource_type,language,level,free_or_paid,skill_tags")
            .eq("is_active", True)
            .or_(f"title.ilike.%{skill}%,description.ilike.%{skill}%")
            .limit(limit)
            .execute()
        )

        rows = result.data or []
        return [
            ResourceResult(
                resource_id=row["id"],
                title=row.get("title") or "Untitled resource",
                provider=row.get("provider"),
                source_url=row.get("source_url"),
                resource_type=row.get("resource_type"),
                free_or_paid=row.get("free_or_paid"),
                language=row.get("language") or "en",
                level=row.get("level"),
                keyword_score=max(0.1, 1 - index / max(limit, 1)),
                vector_score=0,
                matched_skill_tags=row.get("skill_tags") or [],
            )
            for index, row in enumerate(rows)
        ]

    async def _vector_search(self, skill: str, limit: int) -> List[ResourceResult]:
        embedding = await self._embed_query(skill)
        if not embedding:
            return []

        try:
            result = await self.db.get_client().rpc(
                "roadmap_semantic_search",
                {
                    "query_embedding": f"[{','.join(str(value) for value in embedding)}]",
                    "limit_count": limit,
                    "filters": {},
                },
            ).execute()
            rows = result.data or []
            return [self._resource_from_vector_row(row) for row in rows]
        except Exception as exc:
            logger.warning("Vector RPC failed for %s: %s", skill, exc)
            return []

    async def _embed_query(self, text: str) -> Optional[List[float]]:
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY is not configured; semantic retrieval skipped")
            return None

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    self.embeddings_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://smartcareer.app",
                        "X-OpenRouter-Title": "SmartCareer",
                    },
                    json={
                        "model": self.embedding_model,
                        "input": text,
                        "dimensions": 1536,
                    },
                )
                response.raise_for_status()
                payload = response.json()
            embedding = payload.get("data", [{}])[0].get("embedding")
            if not isinstance(embedding, list):
                return None
            return embedding
        except Exception as exc:
            logger.warning("OpenRouter embedding failed for %s: %s", text, exc)
            return None

    def _resource_from_keyword_row(self, row: dict) -> ResourceResult:
        return ResourceResult(
            resource_id=row["resource_id"],
            title=row.get("title") or row.get("resource_title") or "Untitled resource",
            provider=row.get("provider"),
            source_url=row.get("source_url"),
            resource_type=row.get("resource_type"),
            free_or_paid=row.get("free_or_paid"),
            language=row.get("language") or "en",
            level=row.get("level"),
            keyword_score=float(row.get("keyword_score") or 0),
            vector_score=0,
            matched_skill_tags=row.get("skill_tags") or row.get("matched_skill_tags") or [],
        )

    def _resource_from_vector_row(self, row: dict) -> ResourceResult:
        return ResourceResult(
            resource_id=row["resource_id"],
            title=row.get("title") or row.get("resource_title") or "Untitled resource",
            provider=row.get("provider"),
            source_url=row.get("source_url"),
            resource_type=row.get("resource_type"),
            free_or_paid=row.get("free_or_paid"),
            language=row.get("language") or "en",
            level=row.get("level"),
            keyword_score=0,
            vector_score=float(row.get("semantic_score") or row.get("vector_score") or 0),
            matched_skill_tags=row.get("skill_tags") or row.get("matched_skill_tags") or [],
            chunk_text=row.get("chunk_text"),
        )

    def _clamp_score(self, score: float) -> float:
        return round(max(0.0, min(float(score or 0), 1.0)), 4)

    def _tag_score(self, skill: str, resource: ResourceResult) -> float:
        normalized_skill = self._normalize_token(skill)
        normalized_tags = {self._normalize_token(tag) for tag in resource.matched_skill_tags or []}
        return 1.0 if normalized_skill and normalized_skill in normalized_tags else 0.0

    def _normalize_token(self, value: str) -> str:
        return "".join(char for char in (value or "").lower() if char.isalnum())


async def search_resources(
    skill: str,
    top_k: int = 5,
    db: DatabaseService | None = None,
) -> List[ResourceResult]:
    """
    Convenience module-level export for smoke tests and scripts.
    FastAPI routes should use RoadmapRetrievalService through RoadmapService.
    """
    db = db or await DatabaseService.create()
    return await RoadmapRetrievalService(db).search_resources(skill, top_k)
