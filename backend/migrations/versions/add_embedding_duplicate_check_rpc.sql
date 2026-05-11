-- RPC used by app/ingestion/dedup.py: has_embedding_duplicate
-- Finds the nearest embedding in resource_chunks using the HNSW index.
-- Returns one row if any chunk is within max_distance (cosine), else empty.
CREATE OR REPLACE FUNCTION embedding_duplicate_check(
    query_embedding vector(1536),
    max_distance     float8 DEFAULT 0.03
)
RETURNS TABLE(chunk_id uuid, distance float8)
LANGUAGE sql STABLE PARALLEL SAFE AS
$$
    SELECT id AS chunk_id,
           (embedding <=> query_embedding) AS distance
    FROM   resource_chunks
    WHERE  embedding IS NOT NULL
    ORDER  BY embedding <=> query_embedding
    LIMIT  1
$$;
