from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SmartCareer FastAPI Backend"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    host: str = "0.0.0.0"
    port: int = 3000

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""

    openrouter_api_key: str = ""
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"
    openrouter_embeddings_url: str = "https://openrouter.ai/api/v1/embeddings"
    openrouter_timeout_seconds: float = 90.0
    roadmap_embedding_model: str = "openai/text-embedding-3-small"

    cv_ai_timeout_seconds: int = 120

    redis_url: str = "redis://localhost:6379/0"
    redis_disabled: bool = False

    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"

    log_level: str = "INFO"


settings = Settings()
