from dataclasses import dataclass, field
from typing import Any


@dataclass
class ProviderRecord:
    provider: str
    provider_resource_id: str | None
    source_type: str
    resource_type: str
    title: str
    description: str
    source_url: str
    language: str = "en"
    level: str | None = None
    free_or_paid: str = "free"
    duration_hours: int | None = None
    certificate: bool = False
    skill_tags: list[str] = field(default_factory=list)
    target_roles: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    raw_content: str | None = None
    normalized_content: str | None = None
    source_etag: str | None = None
    source_last_modified: str | None = None


@dataclass
class ChunkRecord:
    chunk_index: int
    chunk_text: str
    token_count: int
    chunk_sha256: str
    embedding: list[float] | None = None
    embedding_model: str | None = None
