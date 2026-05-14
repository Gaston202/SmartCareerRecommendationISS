from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SmartCareer FastAPI Backend"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # CORS — enumerate known origins; never use ["*"] with credentials=True
    cors_allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://10.0.2.2:3000",
        "http://10.0.2.2:8081",
        "exp://localhost:8081",
    ]

    host: str = "0.0.0.0"
    port: int = 3000

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""

    openrouter_api_key: str = ""
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"
    openrouter_embeddings_url: str = "https://openrouter.ai/api/v1/embeddings"
    openrouter_timeout_seconds: float = 90.0

    # Optional separate OpenAI key for direct OpenAI embedding calls.
    # If empty, the system falls back to OpenRouter's embeddings endpoint.
    openai_api_key: str = ""
    openai_embeddings_url: str = "https://api.openai.com/v1/embeddings"

    # Ollama Cloud (used strictly for chatbot)
    ollama_api_key: str = ""
    ollama_host: str = "https://ollama.com"
    ollama_chatbot_model: str = "deepseek-v4-flash:cloud"

    cv_ai_timeout_seconds: int = 120

    redis_url: str = "redis://localhost:6379/0"
    redis_disabled: bool = False

    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"

    log_level: str = "INFO"

    # Embedding model used for roadmap vector search (OpenRouter compatible)
    roadmap_embedding_model: str = "openai/text-embedding-3-small"
    # Fallback embedding models to try if the primary fails (e.g., free-tier users)
    roadmap_embedding_fallbacks: List[str] = [
        "openai/text-embedding-3-large",
        "openai/text-embedding-ada-002",
    ]

    # Ollama embedding model (optional local fallback)
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_embeddings_url: str = "http://localhost:11434/api/embed"


settings = Settings()
