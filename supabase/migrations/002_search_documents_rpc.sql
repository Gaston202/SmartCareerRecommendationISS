-- Create documents table for knowledge base with pgvector embeddings
-- This table stores career/skill documents for semantic search RAG
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL DEFAULT 'career_resources',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'resource',
  metadata JSONB DEFAULT '{}',
  embedding vector(384) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on embedding column for faster similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on collection for filtering by category
CREATE INDEX IF NOT EXISTS documents_collection_idx 
ON documents(collection);

-- Create search_documents RPC function for semantic search with pgvector
-- This function:
-- 1. Takes a query embedding (384 dimensions for all-MiniLM-L6-v2)
-- 2. Uses pgvector similarity (<=> operator) to find nearest neighbors
-- 3. Filters by collection/category if provided
-- 4. Returns top N results with similarity scores
--
-- Usage from Python:
--   from supabase import create_client
--   client = create_client(url, key)
--   results = client.rpc('search_documents', {
--     'query_embedding': embedding,  # list/array of 384 floats
--     'match_count': 5,
--     'match_threshold': 0.5,
--     'collection_filter': 'career_resources'  # or NULL for all
--   }).execute()

CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.5,
  collection_filter text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  title text,
  collection text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.collection,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> query_embedding)) AS similarity
  FROM documents d
  WHERE 
    (collection_filter IS NULL OR d.collection = collection_filter)
    AND (1 - (d.embedding <=> query_embedding)) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Optional: Enable RLS if needed (currently off for simplicity)
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
