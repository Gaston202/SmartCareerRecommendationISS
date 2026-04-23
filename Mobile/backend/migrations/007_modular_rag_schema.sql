-- =============================================
-- MODULAR HYBRID RAG SCHEMA (V1 CLOSED KNOWLEDGE BASE)
-- Tables: resources, resource_chunks, role_skill_map, skill_resource_map, ingestion_jobs
-- =============================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- URL normalization helper for dedup
CREATE OR REPLACE FUNCTION normalize_source_url(url TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(split_part(split_part(trim(url), '#', 1), '?', 1)), '/+$', '');
$$;

-- Updated at trigger helper (safe if it already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 1) Structured resources table
-- =============================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_resource_id TEXT,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('course_platform', 'official_docs', 'tutorial_blog', 'youtube_metadata', 'job_roadmap_article', 'internal_curated')
  ),
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('course', 'article', 'docs', 'video', 'bootcamp', 'roadmap', 'tutorial')
  ),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT NOT NULL,
  source_url_normalized TEXT,
  language TEXT DEFAULT 'en',
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  free_or_paid TEXT CHECK (free_or_paid IN ('free', 'paid', 'mixed')) DEFAULT 'free',
  duration_hours INTEGER,
  certificate BOOLEAN DEFAULT FALSE,
  skill_tags TEXT[] DEFAULT '{}',
  target_roles TEXT[] DEFAULT '{}',
  provider_rating NUMERIC(3,2),
  metadata JSONB DEFAULT '{}'::jsonb,

  raw_content TEXT,
  normalized_content TEXT,
  source_etag TEXT,
  source_last_modified TIMESTAMPTZ,
  raw_content_sha256 TEXT,
  normalized_content_sha256 TEXT,

  last_crawled_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  embedding_status TEXT NOT NULL DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
  embedding_updated_at TIMESTAMPTZ,

  search_tsv tsvector,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_provider_external
  ON resources(provider, provider_resource_id)
  WHERE provider_resource_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_source_url_normalized
  ON resources(source_url_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_normalized_content_sha
  ON resources(normalized_content_sha256)
  WHERE normalized_content_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resources_provider ON resources(provider);
CREATE INDEX IF NOT EXISTS idx_resources_language ON resources(language);
CREATE INDEX IF NOT EXISTS idx_resources_level ON resources(level);
CREATE INDEX IF NOT EXISTS idx_resources_free_or_paid ON resources(free_or_paid);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_certificate ON resources(certificate);
CREATE INDEX IF NOT EXISTS idx_resources_duration ON resources(duration_hours);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_resources_skill_tags ON resources USING GIN(skill_tags);
CREATE INDEX IF NOT EXISTS idx_resources_target_roles ON resources USING GIN(target_roles);
CREATE INDEX IF NOT EXISTS idx_resources_search_tsv ON resources USING GIN(search_tsv);

DROP TRIGGER IF EXISTS trg_resources_updated_at ON resources;
CREATE TRIGGER trg_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION sync_resources_derived_columns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.source_url_normalized := normalize_source_url(NEW.source_url);
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.skill_tags, '{}'), ' ')), 'A') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.target_roles, '{}'), ' ')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resources_sync_derived ON resources;
CREATE TRIGGER trg_resources_sync_derived
  BEFORE INSERT OR UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION sync_resources_derived_columns();

-- =============================================
-- 2) Chunk table with pgvector embeddings
-- =============================================
CREATE TABLE IF NOT EXISTS resource_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_count INTEGER,
  chunk_sha256 TEXT NOT NULL,
  embedding vector(1536),
  embedding_model TEXT,
  embedding_created_at TIMESTAMPTZ,

  search_tsv tsvector,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_resource_chunk_index UNIQUE (resource_id, chunk_index),
  CONSTRAINT uq_resource_chunk_sha UNIQUE (resource_id, chunk_sha256)
);

CREATE INDEX IF NOT EXISTS idx_resource_chunks_resource_id ON resource_chunks(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_chunks_search_tsv ON resource_chunks USING GIN(search_tsv);
CREATE INDEX IF NOT EXISTS idx_resource_chunks_embedding_hnsw
  ON resource_chunks USING hnsw (embedding vector_cosine_ops);

DROP TRIGGER IF EXISTS trg_resource_chunks_updated_at ON resource_chunks;
CREATE TRIGGER trg_resource_chunks_updated_at
  BEFORE UPDATE ON resource_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION sync_resource_chunks_search_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english', coalesce(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resource_chunks_sync_tsv ON resource_chunks;
CREATE TRIGGER trg_resource_chunks_sync_tsv
  BEFORE INSERT OR UPDATE ON resource_chunks
  FOR EACH ROW
  EXECUTE FUNCTION sync_resource_chunks_search_tsv();

-- =============================================
-- 3) Role to skill backbone map
-- =============================================
CREATE TABLE IF NOT EXISTS role_skill_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL,
  career_id UUID REFERENCES careers(id) ON DELETE CASCADE,
  career_title TEXT,
  skill_name TEXT NOT NULL,
  skill_type TEXT NOT NULL DEFAULT 'core' CHECK (skill_type IN ('core', 'supplemental', 'interest', 'trait')),
  priority INTEGER NOT NULL DEFAULT 50,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration_hours INTEGER,
  prerequisites TEXT[] DEFAULT '{}',
  evidence_source TEXT NOT NULL DEFAULT 'careers_table',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_skill_map_role_skill ON role_skill_map(role_key, skill_name);
CREATE INDEX IF NOT EXISTS idx_role_skill_map_career_id ON role_skill_map(career_id);
CREATE INDEX IF NOT EXISTS idx_role_skill_map_priority ON role_skill_map(role_key, priority DESC);
CREATE INDEX IF NOT EXISTS idx_role_skill_map_prereq ON role_skill_map USING GIN(prerequisites);

DROP TRIGGER IF EXISTS trg_role_skill_map_updated_at ON role_skill_map;
CREATE TRIGGER trg_role_skill_map_updated_at
  BEFORE UPDATE ON role_skill_map
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 4) Skill to resource relevance map
-- =============================================
CREATE TABLE IF NOT EXISTS skill_resource_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name TEXT NOT NULL,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  relevance_score NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  evidence TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_skill_resource_map UNIQUE (skill_name, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_resource_map_skill ON skill_resource_map(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_resource_map_resource ON skill_resource_map(resource_id);
CREATE INDEX IF NOT EXISTS idx_skill_resource_map_relevance ON skill_resource_map(skill_name, relevance_score DESC);

DROP TRIGGER IF EXISTS trg_skill_resource_map_updated_at ON skill_resource_map;
CREATE TRIGGER trg_skill_resource_map_updated_at
  BEFORE UPDATE ON skill_resource_map
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 5) Ingestion job tracking
-- =============================================
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('monthly_refresh', 'on_demand_refresh', 'backfill')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_reason TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  stats JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_provider_status ON ingestion_jobs(provider, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_type_status ON ingestion_jobs(job_type, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_ingestion_jobs_updated_at ON ingestion_jobs;
CREATE TRIGGER trg_ingestion_jobs_updated_at
  BEFORE UPDATE ON ingestion_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Search RPC: keyword/full-text
-- =============================================
CREATE OR REPLACE FUNCTION roadmap_keyword_search(
  query_text TEXT,
  limit_count INTEGER DEFAULT 30,
  filters JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  resource_id UUID,
  chunk_id UUID,
  title TEXT,
  provider TEXT,
  source_url TEXT,
  resource_type TEXT,
  language TEXT,
  level TEXT,
  free_or_paid TEXT,
  keyword_score DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  WITH scoped_resources AS (
    SELECT r.*
    FROM resources r
    WHERE r.is_active = TRUE
      AND (filters ? 'level' IS FALSE OR r.level = filters->>'level')
      AND (filters ? 'free_or_paid' IS FALSE OR r.free_or_paid = filters->>'free_or_paid')
      AND (filters ? 'language' IS FALSE OR r.language = filters->>'language')
      AND (filters ? 'resource_type' IS FALSE OR r.resource_type = filters->>'resource_type')
      AND (filters ? 'provider' IS FALSE OR r.provider = filters->>'provider')
      AND (filters ? 'certificate' IS FALSE OR r.certificate = (filters->>'certificate')::boolean)
      AND (filters ? 'duration_max' IS FALSE OR r.duration_hours IS NULL OR r.duration_hours <= (filters->>'duration_max')::integer)
      AND (filters ? 'target_role' IS FALSE OR r.target_roles @> ARRAY[filters->>'target_role']::text[])
      AND (
        filters ? 'skill_tags' IS FALSE
        OR r.skill_tags && ARRAY(
          SELECT jsonb_array_elements_text(filters->'skill_tags')
        )
      )
  ),
  query_terms AS (
    SELECT regexp_replace(lower(term), '[^a-z0-9]+', '', 'g') AS term
    FROM regexp_split_to_table(query_text, '\s+') AS term
    WHERE regexp_replace(lower(term), '[^a-z0-9]+', '', 'g') <> ''
  ),
  query_meta AS (
    SELECT string_agg(term, ' | ') AS tsquery_text
    FROM query_terms
  )
  SELECT
    r.id AS resource_id,
    rc.id AS chunk_id,
    r.title,
    r.provider,
    r.source_url,
    r.resource_type,
    r.language,
    r.level,
    r.free_or_paid,
    (
      ts_rank_cd(
        setweight(to_tsvector('english', coalesce(r.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(r.description, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(coalesce(r.skill_tags, '{}'), ' ')), 'A') ||
        setweight(to_tsvector('english', array_to_string(coalesce(r.target_roles, '{}'), ' ')), 'B') ||
        setweight(to_tsvector('english', coalesce(rc.chunk_text, '')), 'C'),
        to_tsquery('english', qm.tsquery_text)
      )
    ) AS keyword_score
  FROM scoped_resources r
  JOIN resource_chunks rc ON rc.resource_id = r.id
  CROSS JOIN query_meta qm
  WHERE (
      qm.tsquery_text IS NOT NULL
      AND
      (setweight(to_tsvector('english', coalesce(r.title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(r.description, '')), 'B') ||
       setweight(to_tsvector('english', array_to_string(coalesce(r.skill_tags, '{}'), ' ')), 'A') ||
       setweight(to_tsvector('english', array_to_string(coalesce(r.target_roles, '{}'), ' ')), 'B') ||
       setweight(to_tsvector('english', coalesce(rc.chunk_text, '')), 'C'))
      @@ to_tsquery('english', qm.tsquery_text)
    )
  ORDER BY keyword_score DESC
  LIMIT limit_count;
$$;

-- =============================================
-- Search RPC: semantic/vector
-- =============================================
CREATE OR REPLACE FUNCTION roadmap_semantic_search(
  query_embedding vector(1536),
  limit_count INTEGER DEFAULT 30,
  filters JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  resource_id UUID,
  chunk_id UUID,
  title TEXT,
  provider TEXT,
  source_url TEXT,
  resource_type TEXT,
  language TEXT,
  level TEXT,
  free_or_paid TEXT,
  semantic_score DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    r.id AS resource_id,
    rc.id AS chunk_id,
    r.title,
    r.provider,
    r.source_url,
    r.resource_type,
    r.language,
    r.level,
    r.free_or_paid,
    (1 - (rc.embedding <=> query_embedding))::double precision AS semantic_score
  FROM resource_chunks rc
  JOIN resources r ON r.id = rc.resource_id
  WHERE r.is_active = TRUE
    AND rc.embedding IS NOT NULL
    AND (filters ? 'level' IS FALSE OR r.level = filters->>'level')
    AND (filters ? 'free_or_paid' IS FALSE OR r.free_or_paid = filters->>'free_or_paid')
    AND (filters ? 'language' IS FALSE OR r.language = filters->>'language')
    AND (filters ? 'resource_type' IS FALSE OR r.resource_type = filters->>'resource_type')
    AND (filters ? 'provider' IS FALSE OR r.provider = filters->>'provider')
    AND (filters ? 'certificate' IS FALSE OR r.certificate = (filters->>'certificate')::boolean)
    AND (filters ? 'duration_max' IS FALSE OR r.duration_hours IS NULL OR r.duration_hours <= (filters->>'duration_max')::integer)
    AND (filters ? 'target_role' IS FALSE OR r.target_roles @> ARRAY[filters->>'target_role']::text[])
    AND (
      filters ? 'skill_tags' IS FALSE
      OR r.skill_tags && ARRAY(
        SELECT jsonb_array_elements_text(filters->'skill_tags')
      )
    )
  ORDER BY rc.embedding <=> query_embedding
  LIMIT limit_count;
$$;

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_skill_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_resource_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Resources are publicly readable" ON resources;
CREATE POLICY "Resources are publicly readable" ON resources
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Resource chunks are publicly readable" ON resource_chunks;
CREATE POLICY "Resource chunks are publicly readable" ON resource_chunks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Role-skill map is publicly readable" ON role_skill_map;
CREATE POLICY "Role-skill map is publicly readable" ON role_skill_map
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Skill-resource map is publicly readable" ON skill_resource_map;
CREATE POLICY "Skill-resource map is publicly readable" ON skill_resource_map
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ingestion jobs owner access" ON ingestion_jobs;
CREATE POLICY "Ingestion jobs owner access" ON ingestion_jobs
  FOR ALL USING (requested_by = auth.uid());

-- Backfill derived columns for existing rows
UPDATE resources
SET
  source_url_normalized = normalize_source_url(source_url),
  search_tsv =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(skill_tags, '{}'), ' ')), 'A') ||
    setweight(to_tsvector('english', array_to_string(coalesce(target_roles, '{}'), ' ')), 'B')
WHERE TRUE;

UPDATE resource_chunks
SET search_tsv = to_tsvector('english', coalesce(chunk_text, ''))
WHERE TRUE;

SELECT 'Modular hybrid RAG schema migration complete!' AS message;
