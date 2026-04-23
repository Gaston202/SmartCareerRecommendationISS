import os


class Settings:
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    embedding_api_key = openrouter_api_key or openai_api_key
    embedding_base_url = os.getenv(
        "OPENROUTER_EMBEDDINGS_URL" if openrouter_api_key else "OPENAI_EMBEDDINGS_URL",
        "https://openrouter.ai/api/v1" if openrouter_api_key else "https://api.openai.com/v1",
    )
    _configured_embedding_model = os.getenv("ROADMAP_EMBEDDING_MODEL", "").strip()
    embedding_model = _configured_embedding_model or (
        "openai/text-embedding-3-small" if openrouter_api_key else "text-embedding-3-small"
    )

    refresh_mode = os.getenv("INGESTION_REFRESH_MODE", "monthly_refresh")
    default_chunk_size = int(os.getenv("INGESTION_CHUNK_SIZE", "900"))
    default_chunk_overlap = int(os.getenv("INGESTION_CHUNK_OVERLAP", "120"))


settings = Settings()
