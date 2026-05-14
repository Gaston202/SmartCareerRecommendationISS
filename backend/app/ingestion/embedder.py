from typing import List, Optional

import httpx

from app.core.config import settings


class Embedder:
    def __init__(self):
        # Prefer explicit OpenAI key; fall back to OpenRouter key.
        self.api_key = settings.openai_api_key or settings.openrouter_api_key
        # Only use the OpenAI direct endpoint if an OpenAI key is provided;
        # otherwise prefer the OpenRouter embeddings endpoint.
        self.embeddings_url = (
            (settings.openai_embeddings_url if settings.openai_api_key else None)
            or settings.openrouter_embeddings_url
            or "https://openrouter.ai/api/v1/embeddings"
        )
        self.primary_model = settings.roadmap_embedding_model
        self.fallback_models = list(settings.roadmap_embedding_fallbacks)

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if not self.api_key:
            return [[] for _ in texts]

        models_to_try = [self.primary_model] + self.fallback_models
        last_error = None

        for model in models_to_try:
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.post(
                        self.embeddings_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model,
                            "input": texts,
                        },
                    )
                    response.raise_for_status()
                    payload = response.json()
                rows = payload.get("data") or []
                embeddings = [row.get("embedding") or [] for row in rows]
                if len(embeddings) < len(texts):
                    embeddings.extend([[] for _ in range(len(texts) - len(embeddings))])
                if any(e for e in embeddings):
                    return embeddings
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (401, 403):
                    print(f"[Embedder] Model '{model}' rejected key ({exc.response.status_code}). Trying fallback...")
                else:
                    print(f"[Embedder] Model '{model}' failed with status {exc.response.status_code}.")
                last_error = exc
            except Exception as exc:
                print(f"[Embedder] Model '{model}' request failed: {exc}")
                last_error = exc

        print(
            f"[Embedder] ERROR: All embedding models exhausted. "
            f"Last error: {last_error}"
        )
        return [[] for _ in texts]
