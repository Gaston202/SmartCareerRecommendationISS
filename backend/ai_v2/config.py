"""
Configuration for AI v2 module.

Central place for environment variables, constants, and settings.
"""

import os
from typing import Optional
from pathlib import Path

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        load_dotenv(env_file)
except ImportError:
    pass  # dotenv not installed, use environment variables only


class AIConfig:
    """
    Configuration class for the AI v2 module.
    
    Loads settings from environment variables with sensible defaults.
    """

    # API and External Services - Using OpenRouter
    OPENROUTER_API_KEY: Optional[str] = os.getenv("OPENROUTER_API_KEY")
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    LLM_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    
    # TODO: Add other LLM providers when implemented
    # ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    # LLAMA_MODEL_PATH: Optional[str] = os.getenv("LLAMA_MODEL_PATH")

    # ========================================================================
    # Embedding Configuration (FREE local embeddings via sentence-transformers)
    # ========================================================================
    
    # Provider: "local" (sentence-transformers) or "openai" (requires API key)
    # Recommendation: Use "local" for free/unlimited embeddings
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "local")
    
    # Model name for local embeddings (sentence-transformers models)
    # all-MiniLM-L6-v2: 384-dim, fast, good quality
    # all-mpnet-base-v2: 768-dim, better quality, slower
    # distiluse-base-multilingual-cased-v2: Multilingual support
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    
    # ========================================================================
    # Supabase Configuration (pgvector for semantic search)
    # ========================================================================
    
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    # Use old key name for backwards compatibility
    SUPABASE_KEY: Optional[str] = SUPABASE_ANON_KEY or os.getenv("SUPABASE_KEY")
    
    # Enable Supabase pgvector backend for RAG (requires SUPABASE_URL + keys)
    # If disabled, falls back to in-memory retriever
    USE_SUPABASE_RAG: bool = os.getenv("USE_SUPABASE_RAG", "false").lower() == "true"
    
    # ========================================================================
    # RAG Configuration
    # ========================================================================
    
    ENABLE_RAG: bool = os.getenv("ENABLE_RAG", "true").lower() == "true"
    
    # Supabase table name for documents (must match actual table in Supabase)
    # Default: "documents" (pgvector knowledge base table created in migration 002)
    # Can override with environment variable: SUPABASE_DOCUMENTS_TABLE
    SUPABASE_DOCUMENTS_TABLE: str = os.getenv("SUPABASE_DOCUMENTS_TABLE", "documents")
    
    # TODO: Configure alternative vector store backends (Pinecone, Weaviate, Milvus, FAISS)
    # VECTOR_STORE_TYPE: str = os.getenv("VECTOR_STORE_TYPE", "supabase")
    # VECTOR_STORE_HOST: Optional[str] = os.getenv("VECTOR_STORE_HOST")
    # VECTOR_STORE_API_KEY: Optional[str] = os.getenv("VECTOR_STORE_API_KEY")

    # Database
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")

    # Pipeline Settings
    MAX_AGENTS: int = int(os.getenv("MAX_AGENTS", "5"))
    TIMEOUT_SECONDS: int = int(os.getenv("TIMEOUT_SECONDS", "60"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Feature Flags
    # TODO: Use these to enable/disable agents or features during development
    ENABLE_PROFILE_AGENT: bool = os.getenv("ENABLE_PROFILE_AGENT", "true").lower() == "true"
    ENABLE_CV_AGENT: bool = os.getenv("ENABLE_CV_AGENT", "true").lower() == "true"
    ENABLE_CAREER_AGENT: bool = os.getenv("ENABLE_CAREER_AGENT", "true").lower() == "true"
    ENABLE_GAP_AGENT: bool = os.getenv("ENABLE_GAP_AGENT", "true").lower() == "true"
    ENABLE_ROADMAP_AGENT: bool = os.getenv("ENABLE_ROADMAP_AGENT", "true").lower() == "true"
    ENABLE_EXPLANATION_AGENT: bool = os.getenv("ENABLE_EXPLANATION_AGENT", "true").lower() == "true"
    
    # Advanced Features (Phase 2)
    ENABLE_TOOL_CALLING: bool = os.getenv("ENABLE_TOOL_CALLING", "false").lower() == "true"

    @classmethod
    def validate(cls) -> bool:
        """
        Validate configuration settings.
        
        Optional API keys are allowed for demo/testing mode.
        LLM features will use mock implementations if API keys are not provided.
        
        Returns:
            bool: True if validation passes
        """
        # API keys are optional - allow demo mode without real LLM access
        if not cls.OPENROUTER_API_KEY:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("OPENROUTER_API_KEY not set - using mock LLM implementations for testing")
        
        return True


# Global config instance
config = AIConfig()
