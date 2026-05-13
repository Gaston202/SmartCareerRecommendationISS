from typing import List

import httpx

from app.core.config import settings


class Embedder:
    def __init__(self):
        # Prefer explicit OpenAI key; fall back to OpenRouter key.
        # Both endpoints (openai.com and openrouter.ai/api/v1/embeddings) are valid.
        self.api_key = settings.openai_api_key or settings.openrouter_api_key
        self.embeddings_url = (
            settings.openai_embeddings_url
            or settings.openrouter_embeddings_url
            or "https://openrouter.ai/api/v1/embeddings"
        )
        self.model = settings.roadmap_embedding_model

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if not self.api_key:
            return [[] for _ in texts]

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    self.embeddings_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "input": texts,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 403:
                print(
                    "[Embedder] ERROR: Embedding API returned 403 Forbidden.\n"
                    "Check your API key and endpoint configuration.\n"
                    "If using OpenRouter, ensure OPENROUTER_API_KEY is set.\n"
                    "If using OpenAI directly, set OPENAI_API_KEY."
                )
            elif exc.response.status_code == 401:
                print(
                    "[Embedder] ERROR: Embedding API authentication failed (401).\n"
                    "Please check your OPENAI_API_KEY or OPENROUTER_API_KEY in .env."
                )
            else:
                print(f"[Embedder] ERROR: Embedding API failed with status {exc.response.status_code}")
            return [[] for _ in texts]
        except Exception as exc:
            print(f"[Embedder] ERROR: Embedding request failed: {exc}")
            return [[] for _ in texts]

        rows = payload.get("data") or []
        embeddings = [row.get("embedding") or [] for row in rows]
        if len(embeddings) < len(texts):
            embeddings.extend([[] for _ in range(len(texts) - len(embeddings))])
        return embeddings
