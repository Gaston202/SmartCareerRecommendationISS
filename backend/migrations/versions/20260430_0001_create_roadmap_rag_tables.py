"""create roadmap rag tables

Revision ID: 20260430_0001
Revises: 
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql


revision: str = "20260430_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "resources",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("provider", sa.String(length=120), nullable=False),
        sa.Column("provider_resource_id", sa.String(length=255), nullable=True),
        sa.Column("source_type", sa.String(length=40), server_default="internal_curated", nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_url_normalized", sa.Text(), nullable=True),
        sa.Column("normalized_content_sha256", sa.String(length=64), nullable=True),
        sa.Column("resource_type", sa.String(length=40), server_default="article", nullable=False),
        sa.Column("language", sa.String(length=12), server_default="en", nullable=False),
        sa.Column("level", sa.String(length=30), nullable=True),
        sa.Column("free_or_paid", sa.String(length=20), server_default="free", nullable=False),
        sa.Column("duration_hours", sa.Integer(), nullable=True),
        sa.Column("certificate", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("skill_tags", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False),
        sa.Column("target_roles", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False),
        sa.Column("provider_rating", sa.Float(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("embedding_status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("embedding_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_resources_provider_external", "resources", ["provider", "provider_resource_id"])
    op.create_unique_constraint("uq_resources_source_url_normalized", "resources", ["source_url_normalized"])
    op.create_index("idx_resources_provider", "resources", ["provider"])
    op.create_index("idx_resources_language", "resources", ["language"])
    op.create_index("idx_resources_level", "resources", ["level"])
    op.create_index("idx_resources_free_or_paid", "resources", ["free_or_paid"])
    op.create_index("idx_resources_type", "resources", ["resource_type"])
    op.create_index("idx_resources_active", "resources", ["is_active"])
    op.create_index("idx_resources_skill_tags", "resources", ["skill_tags"], postgresql_using="gin")
    op.create_index("idx_resources_target_roles", "resources", ["target_roles"], postgresql_using="gin")

    op.create_table(
        "resource_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("resources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("chunk_sha256", sa.String(length=64), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_resource_chunk_index", "resource_chunks", ["resource_id", "chunk_index"])
    op.create_index("idx_resource_chunks_resource_id", "resource_chunks", ["resource_id"])
    op.create_index(
        "idx_resource_chunks_embedding_hnsw",
        "resource_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "role_skill_map",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("career_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("role_key", sa.String(length=180), nullable=False),
        sa.Column("skill_name", sa.String(length=180), nullable=False),
        sa.Column("difficulty", sa.String(length=30), nullable=True),
        sa.Column("estimated_duration_hours", sa.Integer(), nullable=True),
        sa.Column("prerequisites", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False),
        sa.Column("priority", sa.Integer(), server_default="0", nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_prerequisite", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_role_skill_map_role_skill", "role_skill_map", ["role_key", "skill_name"])
    op.create_index("idx_role_skill_map_role_key", "role_skill_map", ["role_key"])
    op.create_index("idx_role_skill_map_priority", "role_skill_map", ["role_key", "priority"])

    op.create_table(
        "skill_resource_map",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("skill_name", sa.String(length=180), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("resources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relevance_score", sa.Float(), server_default="0", nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_skill_resource_map", "skill_resource_map", ["skill_name", "resource_id"])
    op.create_index("idx_skill_resource_map_skill", "skill_resource_map", ["skill_name"])
    op.create_index("idx_skill_resource_map_resource", "skill_resource_map", ["resource_id"])

    op.create_table(
        "ingestion_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("provider", sa.String(length=120), nullable=False),
        sa.Column("job_type", sa.String(length=60), server_default="on_demand_refresh", nullable=False),
        sa.Column("status", sa.String(length=40), server_default="pending", nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("trigger_reason", sa.Text(), nullable=True),
        sa.Column("filters", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("stats", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_ingestion_jobs_provider_status", "ingestion_jobs", ["provider", "status"])
    op.create_index("idx_ingestion_jobs_type_status", "ingestion_jobs", ["job_type", "status"])

    op.execute(
        """
        CREATE OR REPLACE FUNCTION roadmap_keyword_search(
            query_text text,
            limit_count integer DEFAULT 10,
            filters jsonb DEFAULT '{}'::jsonb
        )
        RETURNS TABLE (
            resource_id uuid,
            title text,
            provider text,
            source_url text,
            resource_type text,
            language text,
            level text,
            free_or_paid text,
            keyword_score real
        )
        LANGUAGE sql
        STABLE
        AS $$
            WITH query AS (
                SELECT websearch_to_tsquery('english', query_text) AS tsq
            ),
            scored AS (
                SELECT
                    r.id AS resource_id,
                    r.title::text,
                    r.provider::text,
                    r.source_url::text,
                    r.resource_type::text,
                    r.language::text,
                    r.level::text,
                    r.free_or_paid::text,
                    ts_rank_cd(
                        setweight(to_tsvector('english', coalesce(r.title, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(r.description, '')), 'B') ||
                        setweight(to_tsvector('english', array_to_string(coalesce(r.skill_tags, '{}'), ' ')), 'A') ||
                        setweight(to_tsvector('english', array_to_string(coalesce(r.target_roles, '{}'), ' ')), 'B') ||
                        setweight(to_tsvector('english', coalesce(rc.chunk_text, '')), 'C'),
                        query.tsq
                    ) AS keyword_score
                FROM resources r
                JOIN resource_chunks rc ON rc.resource_id = r.id
                CROSS JOIN query
                WHERE r.is_active = true
                  AND (
                    setweight(to_tsvector('english', coalesce(r.title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(r.description, '')), 'B') ||
                    setweight(to_tsvector('english', array_to_string(coalesce(r.skill_tags, '{}'), ' ')), 'A') ||
                    setweight(to_tsvector('english', array_to_string(coalesce(r.target_roles, '{}'), ' ')), 'B') ||
                    setweight(to_tsvector('english', coalesce(rc.chunk_text, '')), 'C')
                  ) @@ query.tsq
            )
            SELECT
                scored.resource_id,
                max(scored.title) AS title,
                max(scored.provider) AS provider,
                max(scored.source_url) AS source_url,
                max(scored.resource_type) AS resource_type,
                max(scored.language) AS language,
                max(scored.level) AS level,
                max(scored.free_or_paid) AS free_or_paid,
                max(scored.keyword_score)::real AS keyword_score
            FROM scored
            GROUP BY scored.resource_id
            ORDER BY keyword_score DESC
            LIMIT limit_count;
        $$;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION roadmap_semantic_search(
            query_embedding vector(1536),
            limit_count integer DEFAULT 10,
            filters jsonb DEFAULT '{}'::jsonb
        )
        RETURNS TABLE (
            resource_id uuid,
            title text,
            provider text,
            source_url text,
            resource_type text,
            language text,
            level text,
            free_or_paid text,
            semantic_score real,
            chunk_text text
        )
        LANGUAGE sql
        STABLE
        AS $$
            SELECT
                r.id AS resource_id,
                r.title::text,
                r.provider::text,
                r.source_url::text,
                r.resource_type::text,
                r.language::text,
                r.level::text,
                r.free_or_paid::text,
                (1 - (rc.embedding <=> query_embedding))::real AS semantic_score,
                rc.chunk_text::text
            FROM resource_chunks rc
            JOIN resources r ON r.id = rc.resource_id
            WHERE r.is_active = true
              AND rc.embedding IS NOT NULL
            ORDER BY rc.embedding <=> query_embedding
            LIMIT limit_count;
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS roadmap_semantic_search(vector, integer, jsonb)")
    op.execute("DROP FUNCTION IF EXISTS roadmap_keyword_search(text, integer, jsonb)")

    op.drop_index("idx_ingestion_jobs_type_status", table_name="ingestion_jobs")
    op.drop_index("idx_ingestion_jobs_provider_status", table_name="ingestion_jobs")
    op.drop_table("ingestion_jobs")

    op.drop_index("idx_skill_resource_map_resource", table_name="skill_resource_map")
    op.drop_index("idx_skill_resource_map_skill", table_name="skill_resource_map")
    op.drop_table("skill_resource_map")

    op.drop_index("idx_role_skill_map_priority", table_name="role_skill_map")
    op.drop_index("idx_role_skill_map_role_key", table_name="role_skill_map")
    op.drop_table("role_skill_map")

    op.drop_index("idx_resource_chunks_embedding_hnsw", table_name="resource_chunks")
    op.drop_index("idx_resource_chunks_resource_id", table_name="resource_chunks")
    op.drop_table("resource_chunks")

    op.drop_index("idx_resources_target_roles", table_name="resources")
    op.drop_index("idx_resources_skill_tags", table_name="resources")
    op.drop_index("idx_resources_active", table_name="resources")
    op.drop_index("idx_resources_type", table_name="resources")
    op.drop_index("idx_resources_free_or_paid", table_name="resources")
    op.drop_index("idx_resources_level", table_name="resources")
    op.drop_index("idx_resources_language", table_name="resources")
    op.drop_index("idx_resources_provider", table_name="resources")
    op.drop_table("resources")
