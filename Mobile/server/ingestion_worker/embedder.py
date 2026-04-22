from typing import Sequence

import requests
from openai import OpenAI


class Embedder:
    def __init__(self, api_key: str, model: str, base_url: str | None = None) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.model = self._resolve_model(model, base_url)
        self.client = OpenAI(api_key=api_key, base_url=base_url) if api_key else None

    def embed_texts(self, texts: Sequence[str]) -> list[list[float] | None]:
        if not texts:
            return []
        if not self.client:
            return [None for _ in texts]

        if self._uses_openrouter():
            response = requests.post(
                f"{self.base_url.rstrip('/')}/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": list(texts),
                    "dimensions": 1536,
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json().get("data", [])
            return [item.get("embedding") for item in data]

        response = self.client.embeddings.create(model=self.model, input=list(texts))
        return [item.embedding for item in response.data]

    @staticmethod
    def _resolve_model(model: str, base_url: str | None) -> str:
        if base_url and "openrouter.ai" in base_url and "/" not in model:
            return f"openai/{model}"
        return model

    def _uses_openrouter(self) -> bool:
        return bool(self.base_url and "openrouter.ai" in self.base_url)
