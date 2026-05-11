from typing import List

import httpx

from app.core.config import settings


class Embedder:
    def __init__(self):
        self.api_key = settings.openrouter_api_key
        self.embeddings_url = settings.openrouter_embeddings_url
        self.model = settings.roadmap_embedding_model

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if not self.api_key:
            return [[] for _ in texts]

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                self.embeddings_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://smartcareer.app",
                    "X-OpenRouter-Title": "SmartCareer",
                },
                json={
                    "model": self.model,
                    "input": texts,
                    "dimensions": 1536,
                },
            )
            response.raise_for_status()
            payload = response.json()

        rows = payload.get("data") or []
        embeddings = [row.get("embedding") or [] for row in rows]
        if len(embeddings) < len(texts):
            embeddings.extend([[] for _ in range(len(texts) - len(embeddings))])
        return embeddings
