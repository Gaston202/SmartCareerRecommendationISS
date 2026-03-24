# Supabase Setup for RAG with pgvector

This guide explains how to set up Supabase with pgvector for semantic search using local embeddings.

## Prerequisites

- Supabase project created at https://supabase.com
- Admin dashboard access
- `.env` file populated with Supabase credentials

## Environment Variables

Add these to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Embedding Configuration
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2

# RAG Configuration
ENABLE_RAG=true
USE_SUPABASE_RAG=true
```

## Step 1: Enable pgvector Extension

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

## Step 2: Create career_documents Table

Run this SQL to create the main documents table:

```sql
-- Create career_documents table with pgvector support
CREATE TABLE IF NOT EXISTS public.career_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- career, skill, resource, learning_path, market_data
    text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(384),  -- 384 dimensions for all-MiniLM-L6-v2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for similarity search (faster queries)
CREATE INDEX ON public.career_documents USING IVFFLAT (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Alternative: Create HNSW index for better recall (slower index creation)
-- CREATE INDEX ON public.career_documents USING HNSW (embedding vector_cosine_ops);

-- Create indexes for common queries
CREATE INDEX career_docs_category_idx ON public.career_documents(category);
CREATE INDEX career_docs_created_at_idx ON public.career_documents(created_at DESC);

-- Set up Row Level Security (RLS) for public read access
ALTER TABLE public.career_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
    ON public.career_documents FOR SELECT
    USING (true);

-- Create policy for service role to insert/update documents
CREATE POLICY "Service role can manage documents"
    ON public.career_documents FOR ALL
    USING (auth.role() = 'service_role');
```

## Step 3: Hybrid Search Function (Optional but Recommended)

Create a stored procedure for hybrid search (combines keyword search + semantic search):

```sql
-- Create a hybrid search function
CREATE OR REPLACE FUNCTION match_documents(
    query_text TEXT,
    query_embedding vector(384),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    category TEXT,
    text TEXT,
    metadata JSONB,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.id,
        cd.title,
        cd.category,
        cd.text,
        cd.metadata,
        (1 - (cd.embedding <=> query_embedding)) AS similarity
    FROM public.career_documents cd
    WHERE (1 - (cd.embedding <=> query_embedding)) > match_threshold
    ORDER BY cd.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

## Step 4: Load Initial Documents

The `supabase_store.py` module has a function to load initial career documents. Run it:

```python
from backend.ai_v2.rag.supabase_store import SupabaseDocumentStore

# Initialize and load documents
store = SupabaseDocumentStore()
store.load_initial_documents()

print("Documents loaded to Supabase!")
```

Or use SQL directly:

```sql
-- Insert sample career document
INSERT INTO public.career_documents (
    id,
    title,
    category,
    text,
    metadata,
    embedding
)
VALUES (
    'career-backend-engineer',
    'Backend Engineer Role',
    'career',
    'Backend Engineer: Develops server-side logic, APIs, and databases...',
    '{"level": "mid", "salary_min": 80000, "salary_max": 250000, "demand": "very_high"}'::jsonb,
    NULL  -- Will be populated by application
);
```

## Step 5: Test the Setup

Run the test script to verify everything works:

```bash
cd backend/ai_v2
python -c "
from rag.supabase_store import SupabaseDocumentStore
from rag.embedding_service import EmbeddingService

# Initialize
store = SupabaseDocumentStore()
embedding_service = EmbeddingService()

# Test embedding
query = 'Python backend engineer'
embedding = embedding_service.embed(query)
print(f'Embedding dimension: {len(embedding)}')

# Test search (if documents exist)
results = store.search(query_embedding=embedding, top_k=3)
print(f'Found {len(results)} results')
"
```

## Troubleshooting

### pgvector not found
- Make sure the extension is enabled (Step 1)
- Verify with: `SELECT extname FROM pg_extension WHERE extname = 'vector';`

### Table not found
- Check table exists: `SELECT to_regclass('public.career_documents');`
- Run Step 2 again

### Embedding dimension mismatch
- `all-MiniLM-L6-v2` produces 384-dimensional vectors
- Table schema must match: `embedding vector(384)`

### Permission errors
- Verify RLS policies are set correctly
- Make sure service role key is used for insertion

## Migration from In-Memory to Supabase

If you have an existing in-memory document store:

```python
from rag.document_store import DocumentStore
from rag.supabase_store import SupabaseDocumentStore
from rag.embedding_service import EmbeddingService

# Load existing docs
doc_store = DocumentStore()
supabase_store = SupabaseDocumentStore()
embedding_service = EmbeddingService()

# Migrate to Supabase
for doc in doc_store.get_all_documents():
    embedding = embedding_service.embed(doc.content)
    supabase_store.upsert_document(
        id=doc.id,
        title=doc.title,
        category=doc.doc_type.value,
        text=doc.content,
        metadata=doc.metadata,
        embedding=embedding
    )

print("Migration complete!")
```

## Performance Tips

1. **Vector Index**: Use IVFFLAT for balance, HNSW for better quality
2. **Batch Operations**: Insert documents in batches of 100-1000
3. **Metadata**: Store domain-specific metadata in JSONB for filtering
4. **Caching**: Cache embeddings locally to reduce API calls
5. **Connection Pooling**: Use Supabase connection pooling for production

## Next Steps

1. Update `.env` with Supabase credentials
2. Run the SQL scripts to enable pgvector
3. Update `config.py` to enable Supabase backend (set `USE_SUPABASE_RAG=true`)
4. Run `python -m backend.ai_v2.main_pipeline` to test the integration
