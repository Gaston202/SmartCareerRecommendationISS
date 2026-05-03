from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

try:
    from pgvector.sqlalchemy import Vector
except Exception:  # pragma: no cover - keeps imports working when optional package is absent.
    from sqlalchemy.types import UserDefinedType

    class Vector(UserDefinedType):
        def __init__(self, dimensions: int):
            self.dimensions = dimensions

        def get_col_spec(self, **kwargs):
            return f"vector({self.dimensions})"


class Base(DeclarativeBase):
    pass


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (
        UniqueConstraint("provider", "provider_resource_id", name="uq_resources_provider_external"),
        UniqueConstraint("source_url_normalized", name="uq_resources_source_url_normalized"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    provider_resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(40), default="internal_curated")
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_url_normalized: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    normalized_content_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resource_type: Mapped[str] = mapped_column(String(40), default="article")
    language: Mapped[str] = mapped_column(String(12), default="en")
    level: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    free_or_paid: Mapped[str] = mapped_column(String(20), default="free")
    duration_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    certificate: Mapped[bool] = mapped_column(Boolean, default=False)
    skill_tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    target_roles: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    provider_rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    embedding_status: Mapped[str] = mapped_column(String(30), default="pending")
    embedding_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ResourceChunk(Base):
    __tablename__ = "resource_chunks"
    __table_args__ = (
        UniqueConstraint("resource_id", "chunk_index", name="uq_resource_chunk_index"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    resource_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(1536), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RoleSkillMap(Base):
    __tablename__ = "role_skill_map"
    __table_args__ = (
        UniqueConstraint("role_key", "skill_name", name="uq_role_skill_map_role_skill"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    career_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    role_key: Mapped[str] = mapped_column(String(180), nullable=False)
    skill_name: Mapped[str] = mapped_column(String(180), nullable=False)
    difficulty: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    estimated_duration_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    prerequisites: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_prerequisite: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SkillResourceMap(Base):
    __tablename__ = "skill_resource_map"
    __table_args__ = (
        UniqueConstraint("skill_name", "resource_id", name="uq_skill_resource_map"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    skill_name: Mapped[str] = mapped_column(String(180), nullable=False)
    resource_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    job_type: Mapped[str] = mapped_column(String(60), default="on_demand_refresh")
    status: Mapped[str] = mapped_column(String(40), default="pending")
    requested_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    trigger_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filters: Mapped[dict] = mapped_column(JSONB, default=dict)
    stats: Mapped[dict] = mapped_column(JSONB, default=dict)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
