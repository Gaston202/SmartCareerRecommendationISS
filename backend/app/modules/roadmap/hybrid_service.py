import logging
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.cache import CacheService
from app.core.config import settings
from app.core.course_search_service import CourseSearchService
from app.core.database import DatabaseService
from app.modules.roadmap.badges import build_resource_presentation
from app.modules.roadmap.evidence import RoadmapEvidenceService
from app.modules.roadmap.retrieval import RoadmapRetrievalService
from app.modules.roadmap.schemas import (
    EvidenceResource,
    PlannedRoadmapResponse,
    ResourceResult,
    RoadmapStep,
    SkillGap,
)
from app.modules.roadmap.skill_gap import SkillGapService
from app.modules.roadmap.web_search import RoadmapWebSearchService
import httpx

logger = logging.getLogger(__name__)


class HybridRoadmapService:
    """
    Hybrid-RAG learning roadmap service.

    Pipeline:
      1. AI generates an ordered skill sequence from the career context.
      2. Hybrid RAG (keyword + vector, OpenRouter embeddings) retrieves stored
         courses and certifications for each skill.
      3. Evidence scoring picks the best primary + backup resources.
      4. If RAG confidence is low, DuckDuckGo web search fills gaps with real
         online courses.
      5. Returns an enriched roadmap with courses, certifications, and metadata.

    Uses the existing ``openai/text-embedding-3-small`` model via OpenRouter for
    vector search (already configured in ``RoadmapRetrievalService``).
    """

    def __init__(
        self,
        db: DatabaseService,
        ai_orchestrator: Any,  # AIOrchestratorService — avoid circular import
        cache_service: CacheService,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.cache_service = cache_service
        self.skill_gap = SkillGapService(db)
        self.retrieval = RoadmapRetrievalService(db)
        self.evidence = RoadmapEvidenceService(db)
        self.web_search = RoadmapWebSearchService()
        # Pass 8 to DDGS so the quality filter has a larger pool to pick from.
        self.course_search = CourseSearchService(max_results=8)
        self.cert_search = CourseSearchService(max_results=8)
        self.embedding_model = settings.roadmap_embedding_model

    async def generate_hybrid_roadmap(
        self,
        user_skills: List[str],
        target_role: str,
        max_steps: int = 8,
        career_title: Optional[str] = None,
        career_description: Optional[str] = None,
        user_profile: Optional[Dict[str, Any]] = None,
        career_id: Optional[str] = None,
    ) -> PlannedRoadmapResponse:
        """
        Build a hybrid-RAG learning roadmap.

        Steps
        -----
        1. **Skill generation** – AI generates an ordered list of skills for the career.
           If AI is unavailable, falls back to the database ``role_skill_map`` / ``careers`` gap logic.
        2. **RAG resource retrieval** – For each skill, run hybrid keyword + vector search
           against ``resources`` / ``resource_chunks`` (OpenRouter ``text-embedding-3-small``).
        3. **Certification search** – Parallel search for ``certificate=true`` resources.
        4. **Evidence scoring** – Pick primary + backup resources per skill.
        5. **Web fallback** – If confidence is low, search DuckDuckGo for real courses.
        6. **Assembly** – Return a unified ``PlannedRoadmapResponse`` with ``mode=h hybrid_rag_v1``.
        """
        cache_key = (
            f"roadmap:hybrid:v1:{target_role}:"
            f"{','.join(sorted(user_skills))}:{max_steps}"
        )
        cached = await self.cache_service.get(cache_key)
        if cached:
            return PlannedRoadmapResponse(**cached)

        # ── 1. Skill Generation ──────────────────────────────────────────────
        try:
            logger.info("[Hybrid] AI generating roadmap steps for '%s'", target_role)
            ai_steps = await self.ai_orchestrator.generate_roadmap_steps(
                career_title=career_title or target_role,
                career_description=career_description or f"Become a {target_role}",
                user_profile=user_profile,
            )
        except Exception as exc:
            logger.warning("[Hybrid] AI step generation failed: %s — falling back to DB gaps", exc)
            ai_steps = []

        if ai_steps:
            gaps = [
                SkillGap(
                    skill_name=step.get("skill_name", f"Step {i + 1}"),
                    canonical_name=step.get("skill_name", f"step_{i}").lower().replace(" ", "_"),
                    difficulty=step.get("difficulty", "beginner"),
                    estimated_duration_hours=max(4, min(120, step.get("estimated_duration_hours", 16))),
                    prerequisites=step.get("prerequisites", []),
                    priority=i,
                    description=step.get("why_it_matters"),
                )
                for i, step in enumerate(ai_steps[:max_steps])
            ]
        else:
            gaps = await self.skill_gap.compute_gap(user_skills, target_role)
            gaps = gaps[:max(1, max_steps)]

        steps: List[RoadmapStep] = []
        source_urls = set()
        weak_steps = 0
        used_web_search = False

        for index, gap in enumerate(gaps):
            # ── 2. RAG Resource Retrieval ───────────────────────────────────
            resources = await self.retrieval.search_resources(gap.canonical_name, top_k=10)

            # ── 3. Certification Search ────────────────────────────────────
            certifications = await self.retrieval.search_certifications(
                gap.canonical_name, top_k=5
            )

            # ── 4. Evidence Scoring ───────────────────────────────────────
            evidence = await self.evidence.score_evidence(gap.canonical_name, resources)

            # ── 5. Web Fallback (DuckDuckGo) ──────────────────────────────
            fallback_results = []
            primary = evidence.primary_resource

            # Run web search when RAG is weak, missing, or has few backups
            rag_weak = (
                evidence.confidence in ("low", "medium")
                or evidence.needs_web_fallback
                or primary is None
                or len(evidence.backup_resources) < 2
            )
            if rag_weak:
                used_web_search = True
                fallback_results = self._web_search_courses(gap, target_role=target_role)
                if not fallback_results:
                    fallback_results = await self.web_search.fallback_search(gap.canonical_name)

            # Prefer web result as primary when RAG is weak or missing
            if primary is None and fallback_results:
                web_resource = fallback_results[0]
                web_url = web_resource.get("source_url") or web_resource.get("url")
                primary = EvidenceResource(
                    resource_id=web_url or f"web-{index}",
                    title=web_resource.get("title"),
                    provider=web_resource.get("provider"),
                    source_url=web_url,
                    score=web_resource.get("score") or 0.5,
                    why_selected=(
                        f"Selected from web search because stored evidence was weak "
                        f"for {gap.skill_name}."
                    ),
                )

            if evidence.confidence == "low":
                weak_steps += 1

            primary_dict = self._to_dict(primary) if primary else None
            backup_dicts = [self._to_dict(b) for b in evidence.backup_resources]
            # Normalize web results to the same dict shape the frontend expects
            if fallback_results:
                start_idx = 0 if not evidence.primary_resource else 1
                for wr in fallback_results[start_idx:7]:
                    normalized = {
                        "resource_id": wr.get("resource_id") or f"web-{wr.get('url', '')[:32]}",
                        "title": wr.get("title"),
                        "provider": wr.get("provider"),
                        "source_url": wr.get("source_url") or wr.get("url"),
                        "score": wr.get("score", 0.5),
                        "why_selected": wr.get("why_selected") or f"Web search result for {gap.skill_name}",
                        "display_badges": wr.get("display_badges"),
                        "recommendation_reason": wr.get("recommendation_reason"),
                    }
                    backup_dicts.append(normalized)

            # Enrich with badges / metadata
            primary_dict = self._with_resource_presentation(gap.canonical_name, resources, primary_dict)
            backup_dicts = [
                self._with_resource_presentation(gap.canonical_name, resources, b)
                for b in backup_dicts
            ]

            # Certification dicts
            certification_dicts = [
                self._cert_to_dict(cert, resources) for cert in certifications
            ]

            # Validate URLs
            source_url = self._validate_and_extract_url(primary_dict)
            if source_url:
                source_urls.add(source_url)
            else:
                if primary_dict:
                    primary_dict["source_url"] = None

            resource_title = primary_dict.get("title") if primary_dict else None

            steps.append(
                RoadmapStep(
                    skill_name=gap.skill_name,
                    why_it_matters=self._why_skill_matters(gap.skill_name, target_role, resource_title),
                    difficulty=gap.difficulty,
                    estimated_duration_hours=gap.estimated_duration_hours,
                    prerequisites=gap.prerequisites,
                    resource_id=primary_dict.get("resource_id") if primary_dict else None,
                    resource_title=resource_title,
                    resource_type=self._lookup_resource_meta(resources, primary_dict, "resource_type"),
                    free_or_paid=self._lookup_resource_meta(resources, primary_dict, "free_or_paid"),
                    language=self._lookup_resource_meta(resources, primary_dict, "language"),
                    level=self._lookup_resource_meta(resources, primary_dict, "level"),
                    provider=primary_dict.get("provider") if primary_dict else None,
                    source_url=source_url,
                    confidence_score=evidence.score,
                    order_index=index,
                    primary_resource=primary_dict,
                    backup_resources=backup_dicts,
                    evidence_reasons=evidence.reasons,
                    certifications=certification_dicts,
                )
            )

        confidence = round(
            sum(step.confidence_score for step in steps) / max(len(steps), 1), 4
        )
        strong_steps = len(steps) - weak_steps

        response = PlannedRoadmapResponse(
            success=True,
            mode="hybrid_rag_v1",
            target_role=career_title or target_role,
            career_id=career_id,
            confidence=confidence,
            weak_evidence=weak_steps > len(steps) / 2 if steps else True,
            message=(
                "insufficient reliable sources for some steps"
                if weak_steps
                else ("AI-generated + web-enriched" if used_web_search else "AI-generated + RAG-enriched")
            ),
            steps=steps,
            diagnostics={
                "totalCandidates": len(steps),
                "poolSize": len(source_urls),
                "coverageBySkill": {step.skill_name: step.confidence_score for step in steps},
                "embeddingModel": self.embedding_model,
                "usedWebSearch": used_web_search,
                "sourceBreakdown": {
                    "ragResources": len([s for s in steps if s.primary_resource and not str(s.primary_resource.get("resource_id", "")).startswith("web-")]),
                    "webFallbacks": len([s for s in steps if s.primary_resource and str(s.primary_resource.get("resource_id", "")).startswith("web-")]),
                },
            },
            metadata={
                "required_skills": [gap.skill_name for gap in gaps],
                "existing_skills": user_skills,
                "missing_skills": [gap.skill_name for gap in gaps],
                "evidence_summary": {
                    "strong_steps": strong_steps,
                    "weak_steps": weak_steps,
                    "source_count": len(source_urls),
                },
                "generation_method": "ai_then_rag_then_web",
                "embedding_model": self.embedding_model,
            },
        )

        await self.cache_service.set(cache_key, response.model_dump(), 86400)
        return response

    # ── Helpers ────────────────────────────────────────────────────────────

    def _web_search_courses(self, gap: SkillGap, target_role: str = "") -> List[Dict[str, Any]]:
        """
        Search DuckDuckGo for real online courses for this skill.
        Runs course search + certification search, merges results, picks top.
        """
        try:
            # Use the raw skill name for search — queries stay concise and natural
            search_term = gap.skill_name

            # Run both queries in parallel (same thread, sequential calls)
            course_results = self.course_search.search_courses(
                search_term, difficulty=gap.difficulty
            )
            cert_results = self.cert_search.search_certifications(search_term)

            # Merge, preferring higher-scored results
            merged = []
            for r in course_results:
                merged.append({
                    "resource_id": f"ddg-c-{hash(r.get('url', '')) & 0xFFFFFF}",
                    "title": r.get("title", ""),
                    "provider": r.get("provider", "Online Course"),
                    "source_url": r.get("url"),
                    "score": r.get("score", 0.5),
                    "why_selected": f"Course found via web search for {gap.skill_name}",
                })
            for r in cert_results:
                merged.append({
                    "resource_id": f"ddg-cert-{hash(r.get('url', '')) & 0xFFFFFF}",
                    "title": r.get("title", ""),
                    "provider": r.get("provider", "Certification"),
                    "source_url": r.get("url"),
                    "score": r.get("score", 0.5),
                    "why_selected": f"Certification found via web search for {gap.skill_name}",
                })

            # Sort by score, take top 3
            merged.sort(key=lambda x: x["score"], reverse=True)
            return merged[:3]
        except Exception as exc:
            logger.warning("[Hybrid] DuckDuckGo search failed for '%s': %s", gap.skill_name, exc)
            return []

    def _cert_to_dict(self, cert: ResourceResult, resources: List[ResourceResult]) -> Dict[str, Any]:
        """Convert a certification ResourceResult to a serializable dict."""
        d = {
            "resource_id": getattr(cert, "resource_id", None),
            "title": getattr(cert, "title", None),
            "provider": getattr(cert, "provider", None),
            "source_url": getattr(cert, "source_url", None),
            "score": getattr(cert, "final_score", 0),
            "resource_type": getattr(cert, "resource_type", None) or "certification",
            "free_or_paid": getattr(cert, "free_or_paid", None),
            "language": getattr(cert, "language", "en"),
            "level": getattr(cert, "level", None),
        }
        enriched = build_resource_presentation(cert.title, d)
        d["display_badges"] = enriched.display_badges or None
        d["recommendation_reason"] = enriched.recommendation_reason
        return d

    def _to_dict(self, evidence_resource: Optional[EvidenceResource]) -> Optional[Dict[str, Any]]:
        if not evidence_resource:
            return None
        return {
            "resource_id": evidence_resource.resource_id,
            "title": evidence_resource.title,
            "provider": evidence_resource.provider,
            "source_url": evidence_resource.source_url,
            "score": evidence_resource.score,
            "why_selected": evidence_resource.why_selected,
            "display_badges": evidence_resource.display_badges,
            "recommendation_reason": evidence_resource.recommendation_reason,
        }

    def _why_skill_matters(
        self, skill_name: str, target_role: str, resource_title: Optional[str] = None
    ) -> str:
        skill_label = skill_name.replace("_", " ")
        role_label = target_role.replace("_", " ")
        if resource_title:
            return (
                f"{skill_label.title()} is a core competency for {role_label}. "
                f"The recommended course '{resource_title}' covers the exact "
                f"{skill_label} concepts and techniques you need for real-world {role_label} work."
            )
        return (
            f"{skill_label.title()} is essential for {role_label}. "
            f"Building practical proficiency here will help you solve real problems in {role_label} roles."
        )

    def _lookup_resource_meta(
        self,
        resources: List[ResourceResult],
        primary: Optional[dict],
        key: str,
    ) -> Any:
        if not primary:
            return None
        resource_id = primary.get("resource_id")
        for resource in resources:
            if resource.resource_id == resource_id:
                return getattr(resource, key, None)
        return primary.get(key)

    def _with_resource_presentation(
        self,
        skill: str,
        resources: List[ResourceResult],
        resource: Optional[dict],
    ) -> Optional[dict]:
        if not resource:
            return None

        enriched = dict(resource)
        for key in ("resource_type", "free_or_paid", "language", "level"):
            if enriched.get(key) is None:
                enriched[key] = self._lookup_resource_meta(resources, enriched, key)

        presentation = build_resource_presentation(skill, enriched)
        enriched["display_badges"] = presentation.display_badges or None
        enriched["recommendation_reason"] = presentation.recommendation_reason
        return enriched

    def _validate_and_extract_url(self, primary_dict: Optional[dict]) -> Optional[str]:
        if not primary_dict:
            return None
        url = primary_dict.get("source_url")
        if url and self._is_valid_url(url):
            return url
        if url:
            logger.warning("Invalid source_url: %s", url)
            primary_dict["source_url"] = None
        return None

    def _is_valid_url(self, url: str) -> bool:
        if not url or not isinstance(url, str):
            return False
        try:
            parsed = urllib.parse.urlparse(url)
            if not parsed.scheme or parsed.scheme not in {"http", "https"}:
                return False
            if not parsed.netloc or "." not in parsed.netloc:
                return False
            blocked = {"example.com", "localhost", "127.0.0.1", "test.com", "demo.com"}
            hostname = parsed.netloc.lower().replace("www.", "")
            if hostname in blocked or hostname.startswith("localhost"):
                return False
            return True
        except Exception:
            return False


async def generate_hybrid_roadmap(
    user_skills: List[str],
    target_role: str,
    db: Optional[DatabaseService] = None,
    ai_orchestrator: Any = None,
    cache_service: Optional[CacheService] = None,
    career_title: Optional[str] = None,
    career_description: Optional[str] = None,
    user_profile: Optional[Dict[str, Any]] = None,
    career_id: Optional[str] = None,
) -> PlannedRoadmapResponse:
    """
    Convenience module-level export for smoke tests and scripts.
    FastAPI routes should use ``HybridRoadmapService`` via dependency injection.
    """
    from app.core.ai_orchestrator import AIOrchestratorService

    db = db or await DatabaseService.create()
    cache_service = cache_service or CacheService()
    ai = ai_orchestrator or AIOrchestratorService()
    service = HybridRoadmapService(db, ai, cache_service)
    return await service.generate_hybrid_roadmap(
        user_skills=user_skills,
        target_role=target_role,
        career_title=career_title,
        career_description=career_description,
        user_profile=user_profile,
        career_id=career_id,
    )
