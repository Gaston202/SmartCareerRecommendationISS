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
            # 🆕 STRICT: Reject resources with no skill relevance
            title_relevance = self._title_relevance_score(skill, resource)
            if title_relevance < 0.3:
                logger.debug(
                    "Rejecting resource '%s' for skill '%s' — title relevance too low (%.2f)",
                    resource.title, skill, title_relevance,
                )
                continue

            overlap_score = await self._chunk_overlap_score(skill, resource)
            tag_score = self._tag_relevance_score(skill, resource)

            # Combined score: title (40%) + tag (30%) + vector/chunk (20%) + final_score (10%)
            score = self._clamp_score(
                (title_relevance * 0.40)
                + (tag_score * 0.30)
                + (overlap_score * 0.20)
                + (resource.final_score * 0.10)
            )
            scored.append((resource, score, overlap_score, title_relevance))

        if not scored:
            return EvidenceResult(
                skill=skill,
                confidence="low",
                needs_web_fallback=True,
                reasons=["No relevant resources found for this skill"],
            )

        scored.sort(key=lambda item: item[1], reverse=True)
        top_resource, top_score, top_overlap, top_title = scored[0]

        confidence = "low"
        if top_score > 0.7 and top_title >= 0.6:
            confidence = "high"
        elif top_score > 0.4 and top_title >= 0.4:
            confidence = "medium"

        primary = self._to_evidence_resource(
            top_resource,
            top_score,
            f"Best match for {skill}: '{top_resource.title}' by {top_resource.provider or 'Unknown'} — "
            f"title relevance={top_title:.0%}, skill-tag match confirmed.",
        )
        backups = [
            self._to_evidence_resource(
                resource,
                score,
                f"Alternative for {skill}: '{resource.title}' by {resource.provider or 'Unknown'} "
                f"(relevance={title_rel:.0%}).",
            )
            for resource, score, overlap, title_rel in scored[1:7]
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

    def _title_relevance_score(self, skill: str, resource: ResourceResult) -> float:
        """
        Check how strongly the resource title relates to the skill.
        Returns 0.0–1.0. High score requires direct skill words in title.
        """
        skill_terms = set(self._tokenize(skill))
        title_terms = set(self._tokenize(resource.title))
        tag_terms = set(self._tokenize(" ".join(resource.matched_skill_tags or [])))

        if not skill_terms:
            return 0.0

        # Direct title matches are strongest
        title_matches = len(skill_terms & title_terms)
        title_score = title_matches / len(skill_terms)

        # Tag matches are secondary
        tag_matches = len(skill_terms & tag_terms)
        tag_score = tag_matches / len(skill_terms)

        # Boost if ALL skill words appear in title (exact match)
        if title_matches == len(skill_terms) and len(skill_terms) >= 1:
            return min(1.0, 0.8 + 0.2 * tag_score)

        # Partial match: weight title higher than tags
        return min(1.0, title_score * 0.7 + tag_score * 0.3)

    def _tag_relevance_score(self, skill: str, resource: ResourceResult) -> float:
        """Score based on skill tags attached to the resource."""
        skill_terms = set(self._tokenize(skill))
        tag_terms = set(self._tokenize(" ".join(resource.matched_skill_tags or [])))
        if not skill_terms:
            return 0.0
        matches = len(skill_terms & tag_terms)
        return round(matches / len(skill_terms), 4)

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
