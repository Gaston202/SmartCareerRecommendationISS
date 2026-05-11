import logging
import re
from typing import List

from app.core.database import DatabaseService
from app.modules.roadmap.schemas import EvidenceResource, EvidenceResult, ResourceResult

logger = logging.getLogger(__name__)


class RoadmapEvidenceService:
    def __init__(self, db: DatabaseService):
        self.db = db

    async def score_evidence(self, skill: str, resources: List[ResourceResult]) -> EvidenceResult:
        if not resources:
            return EvidenceResult(
                skill=skill,
                confidence="low",
                needs_web_fallback=True,
                reasons=["No stored resources found"],
            )

        scored = []
        for resource in resources:
            overlap_score = await self._chunk_overlap_score(skill, resource)
            score = self._clamp_score((resource.final_score * 0.75) + (overlap_score * 0.25))
            scored.append((resource, score, overlap_score))

        scored.sort(key=lambda item: item[1], reverse=True)
        top_resource, top_score, top_overlap = scored[0]

        confidence = "low"
        if top_score > 0.7:
            confidence = "high"
        elif top_score > 0.4:
            confidence = "medium"

        primary = self._to_evidence_resource(
            top_resource,
            top_score,
            f"Selected for {skill}; retrieval={top_resource.final_score:.2f}, chunk_overlap={top_overlap:.2f}.",
        )
        backups = [
            self._to_evidence_resource(
                resource,
                score,
                f"Backup for {skill}; retrieval={resource.final_score:.2f}, chunk_overlap={overlap:.2f}.",
            )
            for resource, score, overlap in scored[1:7]
        ]

        return EvidenceResult(
            skill=skill,
            primary_resource=primary,
            backup_resources=backups,
            score=top_score,
            confidence=confidence,
            needs_web_fallback=confidence == "low",
            reasons=[primary.why_selected],
        )

    async def _chunk_overlap_score(self, skill: str, resource: ResourceResult) -> float:
        chunk_text = resource.chunk_text
        if not chunk_text:
            chunk_text = await self._load_best_chunk(resource.resource_id)

        tags = " ".join(resource.matched_skill_tags or [])
        chunk_text = f"{resource.title} {tags} {chunk_text or ''}".strip()

        skill_terms = self._tokenize(skill)
        chunk_terms = set(self._tokenize(chunk_text))
        if not skill_terms:
            return 0

        matches = sum(1 for term in skill_terms if term in chunk_terms)
        return round(matches / len(skill_terms), 4)

    async def _load_best_chunk(self, resource_id: str) -> str:
        try:
            result = (
                await self.db.get_client()
                .from_("resource_chunks")
                .select("chunk_text")
                .eq("resource_id", resource_id)
                .order("chunk_index")
                .limit(1)
                .execute()
            )
            rows = result.data or []
            return rows[0].get("chunk_text") if rows else ""
        except Exception as exc:
            logger.warning("Failed to load chunk for resource %s: %s", resource_id, exc)
            return ""

    def _to_evidence_resource(self, resource: ResourceResult, score: float, why: str) -> EvidenceResource:
        return EvidenceResource(
            resource_id=resource.resource_id,
            title=resource.title,
            provider=resource.provider,
            source_url=resource.source_url,
            score=score,
            why_selected=why,
        )

    def _clamp_score(self, score: float) -> float:
        return round(max(0.0, min(float(score or 0), 1.0)), 4)

    def _tokenize(self, value: str) -> List[str]:
        return [
            token
            for token in re.split(r"[^a-z0-9]+", (value or "").lower())
            if len(token) > 1
        ]
