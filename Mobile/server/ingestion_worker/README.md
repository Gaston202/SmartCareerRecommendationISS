# Ingestion Worker (Trusted Sources, V1)

This worker ingests roadmap knowledge from trusted curated providers into Supabase.

## Scope
- V1 closed knowledge base only
- No broad live web search
- Monthly refresh + on-demand provider refresh

## Run

```bash
cd Mobile/server
python -m ingestion_worker.main --provider internal_curated --mode monthly_refresh
```

## Environment
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY` (preferred for semantic embeddings)
- `ROADMAP_EMBEDDING_MODEL` (default: `openai/text-embedding-3-small` when using OpenRouter)
- `OPENROUTER_EMBEDDINGS_URL` (optional override, default base URL: `https://openrouter.ai/api/v1`)

## Expected DB tables
- `resources`
- `resource_chunks`
- `role_skill_map`
- `skill_resource_map`
- `ingestion_jobs`

created by backend migration:
- `Mobile/backend/migrations/007_modular_rag_schema.sql`
