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
        # Prefer explicit OpenAI key; fall back to OpenRouter key.
        # Both endpoints (openai.com and openrouter.ai/api/v1/embeddings) are valid.
        self.api_key = settings.openai_api_key or settings.openrouter_api_key
        # Only use the OpenAI direct endpoint if an OpenAI key is provided;
        # otherwise prefer the OpenRouter embeddings endpoint.
        self.embeddings_url = (
            (settings.openai_embeddings_url if settings.openai_api_key else None)
            or settings.openrouter_embeddings_url
            or "https://openrouter.ai/api/v1/embeddings"
        )
        self.embedding_model = settings.roadmap_embedding_model
        self.embedding_fallbacks = list(settings.roadmap_embedding_fallbacks)

        # Track which models have permanently failed auth so we skip them
        self._auth_failed_models: set[str] = set()

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
            # Require title or tags to contain skill terms
            if not self._is_resource_relevant_to_skill(skill, result):
                logger.debug(
                    "Filtering out resource '%s' (id=%s) — not relevant to skill '%s'",
                    result.title, result.resource_id, skill,
                )
                continue

            tag_score = self._tag_score(skill, result)
            result.final_score = self._clamp_score(
                0.30 * result.keyword_score + 0.50 * result.vector_score + 0.20 * tag_score
            )
            if tag_score:
                result.final_score = max(result.final_score, 0.72)
            results.append(result)

        return sorted(results, key=lambda item: item.final_score, reverse=True)[:top_k]

    def _is_resource_relevant_to_skill(self, skill: str, resource: ResourceResult) -> bool:
        """
        Relevance check: the resource title, description, or skill_tags must contain
        meaningful tokens from the skill query.
        """
        if not skill or not resource.title:
            return False

        skill_lower = skill.lower()
        title_lower = resource.title.lower()

        # Quick exact / substring match
        if skill_lower in title_lower:
            return True

        skill_terms = set(self._tokenize(skill))
        if not skill_terms:
            return True  # be lenient when we can't tokenize

        title_terms = set(self._tokenize(resource.title))
        tag_terms = set(self._tokenize(" ".join(resource.matched_skill_tags or [])))

        # At least one skill term must appear in title OR tags
        if skill_terms & (title_terms | tag_terms):
            return True

        # Special case: if resource is tagged with the exact skill
        normalized_skill = self._normalize_token(skill)
        normalized_tags = {self._normalize_token(t) for t in resource.matched_skill_tags or []}
        if normalized_skill in normalized_tags:
            return True

        # Be more lenient for short skills: accept if any single token overlaps
        if len(skill_terms) == 1:
            token = next(iter(skill_terms))
            if token in title_terms or token in tag_terms:
                return True

        return False

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
        """Broad keyword fallback: match title, description, or skill_tags."""
        # Tokenize skill into meaningful search terms
        terms = self._tokenize(skill)
        # Also keep the raw skill for exact phrase matching
        search_terms = list(dict.fromkeys([skill] + terms))

        # Build a Supabase query with multiple ilike conditions
        client = self.db.get_client().from_("resources")
        query = (
            client
            .select("id,title,provider,source_url,resource_type,language,level,free_or_paid,skill_tags")
            .eq("is_active", True)
        )

        # Create an OR chain of ilike conditions for each term
        or_conditions = []
        for term in search_terms:
            if len(term) >= 2:
                or_conditions.append(f"title.ilike.%{term}%")
                or_conditions.append(f"description.ilike.%{term}%")

        if or_conditions:
            query = query.or_(",".join(or_conditions))

        result = await query.limit(limit).execute()
        rows = result.data or []

        # If too few results, try a second query with skill_tags overlap
        if len(rows) < limit // 2:
            tags_result = (
                await self.db.get_client()
                .from_("resources")
                .select("id,title,provider,source_url,resource_type,language,level,free_or_paid,skill_tags")
                .eq("is_active", True)
                .ilike("skill_tags::text", f"%{skill}%")
                .limit(limit)
                .execute()
            )
            tags_rows = tags_result.data or []
            seen = {r["id"] for r in rows}
            for row in tags_rows:
                if row["id"] not in seen:
                    rows.append(row)

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
                keyword_score=max(0.1, 1 - index / max(len(rows), 1)),
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
        """
        Compute an embedding for query text with multi-provider fallback.

        Tries in order:
        1. OpenRouter/OpenAI embedding models (primary + fallbacks)
        2. Ollama local embedding (if configured and reachable)

        Models that return 401/403 are permanently skipped for this instance.
        """
        if not self.api_key:
            logger.warning("No embedding API key configured (OPENROUTER_API_KEY).")

        # ── 1. Try OpenRouter / OpenAI embedding models ──────────────────────
        models_to_try = [self.embedding_model] + self.embedding_fallbacks
        last_error = None

        for model in models_to_try:
            if model in self._auth_failed_models:
                continue

            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.post(
                        self.embeddings_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={"model": model, "input": [text]},
                    )
                    response.raise_for_status()
                    payload = response.json()
                embedding = payload.get("data", [{}])[0].get("embedding")
                if not isinstance(embedding, list):
                    continue
                logger.info("Embedding succeeded with model '%s' (dims=%s)", model, len(embedding))
                return embedding
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status in (401, 403):
                    self._auth_failed_models.add(model)
                    logger.warning(
                        "Embedding model '%s' rejected key (%s). "
                        "This model is permanently skipped for this instance.",
                        model, status,
                    )
                elif status == 400:
                    self._auth_failed_models.add(model)
                    logger.warning(
                        "Embedding model '%s' returned 400 Bad Request — unsupported. "
                        "Permanently skipped.",
                        model,
                    )
                else:
                    logger.warning(
                        "Embedding model '%s' failed for '%s': %s",
                        model, text, exc,
                    )
                last_error = exc
            except Exception as exc:
                logger.warning(
                    "Embedding model '%s' request failed for '%s': %s",
                    model, text, exc,
                )
                last_error = exc

        # ── 2. Try Ollama local embedding fallback ───────────────────────────
        ollama_embed = await self._embed_with_ollama(text)
        if ollama_embed:
            return ollama_embed

        if last_error:
            logger.error(
                "All embedding models exhausted. Vector search disabled. "
                "Last error: %s",
                last_error,
            )
        return None

    async def _embed_with_ollama(self, text: str) -> Optional[List[float]]:
        """Fallback to Ollama local embedding server."""
        url = getattr(settings, "ollama_embeddings_url", None)
        model = getattr(settings, "ollama_embedding_model", None)
        if not url or not model:
            return None

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    url,
                    json={"model": model, "input": text},
                )
                response.raise_for_status()
                payload = response.json()
            # Ollama /api/embed returns {"embeddings": [[...]]}
            embeddings = payload.get("embeddings")
            if embeddings and isinstance(embeddings, list):
                emb = embeddings[0] if isinstance(embeddings[0], list) else embeddings
                if isinstance(emb, list):
                    logger.info("Ollama embedding succeeded (%s dims)", len(emb))
                    return emb
        except Exception as exc:
            logger.debug("Ollama embedding fallback unavailable: %s", exc)
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

    def _tokenize(self, value: str) -> List[str]:
        import re
        return [
            token
            for token in re.split(r"[^a-z0-9]+", (value or "").lower())
            if len(token) > 1
        ]

    # ── Certification Search (certificate=true filter) ───────────────────

    async def search_certifications(self, skill: str, top_k: int = 5) -> List[ResourceResult]:
        """
        Hybrid search scoped to certificate-bearing resources only.
        Reuses the same keyword / vector RPCs but post-filters results
        to keep only rows where the underlying resource has ``certificate=true``.
        """
        top_k = max(1, min(top_k, 20))
        keyword_rows = await self._cert_keyword_search(skill, top_k * 4)
        vector_rows = await self._cert_vector_search(skill, top_k * 4)

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
            if not self._is_resource_relevant_to_skill(skill, result):
                continue

            tag_score = self._tag_score(skill, result)
            result.final_score = self._clamp_score(
                0.30 * result.keyword_score + 0.50 * result.vector_score + 0.20 * tag_score
            )
            if tag_score:
                result.final_score = max(result.final_score, 0.72)
            results.append(result)

        return sorted(results, key=lambda item: item.final_score, reverse=True)[:top_k]

    async def _cert_keyword_search(self, skill: str, limit: int) -> List[ResourceResult]:
        """Keyword search against certificate=true resources."""
        try:
            result = await self.db.get_client().rpc(
                "roadmap_keyword_search",
                {
                    "query_text": skill,
                    "limit_count": limit,
                    "filters": {"certificate": True},
                },
            ).execute()
            rows = result.data or []
            # Extra client-side guard: keep only rows whose resource actually has certificate=true
            return [
                self._resource_from_keyword_row(row)
                for row in rows
                if row.get("certificate") or row.get("resource_type") == "certification"
            ]
        except Exception as exc:
            logger.warning("Cert keyword RPC failed for %s: %s", skill, exc)
            return await self._cert_fallback(skill, limit)

    async def _cert_vector_search(self, skill: str, limit: int) -> List[ResourceResult]:
        """Vector search against certificate-bearing resources."""
        embedding = await self._embed_query(skill)
        if not embedding:
            return []

        try:
            result = await self.db.get_client().rpc(
                "roadmap_semantic_search",
                {
                    "query_embedding": f"[{','.join(str(value) for value in embedding)}]",
                    "limit_count": limit,
                    "filters": {"certificate": True},
                },
            ).execute()
            rows = result.data or []
            # Client-side filter for certificate=true
            return [
                self._resource_from_vector_row(row)
                for row in rows
                if row.get("certificate") or row.get("resource_type") == "certification"
            ]
        except Exception as exc:
            logger.warning("Cert vector RPC failed for %s: %s", skill, exc)
            return []

    async def _cert_fallback(self, skill: str, limit: int) -> List[ResourceResult]:
        """Fallback ilike query scoped to certificate=true."""
        terms = self._tokenize(skill)
        search_terms = list(dict.fromkeys([skill] + terms))

        client = self.db.get_client().from_("resources")
        query = (
            client
            .select("id,title,provider,source_url,resource_type,language,level,free_or_paid,skill_tags")
            .eq("is_active", True)
            .eq("certificate", True)
        )

        or_conditions = []
        for term in search_terms:
            if len(term) >= 2:
                or_conditions.append(f"title.ilike.%{term}%")
                or_conditions.append(f"description.ilike.%{term}%")

        if or_conditions:
            query = query.or_(",".join(or_conditions))

        result = await query.limit(limit).execute()
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
                keyword_score=max(0.1, 1 - index / max(len(rows), 1)),
                vector_score=0,
                matched_skill_tags=row.get("skill_tags") or [],
            )
            for index, row in enumerate(rows)
        ]


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
