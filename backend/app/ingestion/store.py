import hashlib
from typing import List

from app.core.database import DatabaseService
from app.ingestion.normalizer import normalize_url
from app.modules.roadmap.schemas import ResourceSchema


class ResourceStore:
    def __init__(self, db: DatabaseService):
        self.db = db

    async def upsert_resource_with_chunks(
        self,
        resource: ResourceSchema,
        chunks: List[dict],
    ) -> dict:
        resource_payload = {
            "provider": resource.provider,
            "provider_resource_id": resource.provider_resource_id,
            "source_type": "internal_curated",
            "title": resource.title,
            "description": resource.description,
            "source_url": resource.source_url,
            "source_url_normalized": normalize_url(resource.source_url),
            "normalized_content_sha256": self._sha256(resource.content),
            "resource_type": resource.resource_type,
            "language": resource.language,
            "level": resource.level,
            "free_or_paid": resource.free_or_paid,
            "duration_hours": resource.duration_hours,
            "certificate": resource.certificate,
            "skill_tags": resource.skill_tags,
            "target_roles": resource.target_roles,
            "metadata": resource.metadata,
            "embedding_status": "completed" if chunks else "pending",
            "is_active": True,
        }

        result = (
            await self.db.get_client()
            .from_("resources")
            .upsert(resource_payload, on_conflict="source_url_normalized")
            .execute()
        )
        stored = (result.data or [resource_payload])[0]
        resource_id = stored.get("id")

        if resource_id and chunks:
            chunk_payloads = [
                {
                    "resource_id": resource_id,
                    "chunk_index": chunk["chunk_index"],
                    "chunk_text": chunk["chunk_text"],
                    "chunk_sha256": self._sha256(chunk["chunk_text"]),
                    "token_count": chunk.get("token_count"),
                    "embedding": chunk.get("embedding"),
                }
                for chunk in chunks
            ]
            await self.db.get_client().from_("resource_chunks").upsert(
                chunk_payloads,
                on_conflict="resource_id,chunk_index",
            ).execute()

            await self._update_skill_resource_map(resource_id, resource.skill_tags)

        return stored

    async def _update_skill_resource_map(self, resource_id: str, skills: List[str]) -> None:
        if not skills:
            return

        payloads = [
            {
                "skill_name": skill,
                "resource_id": resource_id,
                "relevance_score": 0.8,
                "is_primary": index == 0,
                "is_active": True,
            }
            for index, skill in enumerate(skills)
        ]
        await self.db.get_client().from_("skill_resource_map").upsert(
            payloads,
            on_conflict="skill_name,resource_id",
        ).execute()

    def _sha256(self, value: str) -> str:
        return hashlib.sha256((value or "").encode("utf-8")).hexdigest()
