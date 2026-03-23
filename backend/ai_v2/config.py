"""
Configuration for AI v2 module.

Central place for environment variables, constants, and settings.
"""

import os
from typing import Optional


class AIConfig:
    """
    Configuration class for the AI v2 module.
    
    Loads settings from environment variables with sensible defaults.
    """

    # API and External Services
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4")
    
    # TODO: Add other LLM providers when implemented
    # ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    # LLAMA_MODEL_PATH: Optional[str] = os.getenv("LLAMA_MODEL_PATH")

    # Vector Store and RAG
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    # TODO: Configure vector store backend (Pinecone, Weaviate, Milvus, etc.)
    # VECTOR_STORE_TYPE: str = os.getenv("VECTOR_STORE_TYPE", "pinecone")
    # VECTOR_STORE_HOST: Optional[str] = os.getenv("VECTOR_STORE_HOST")
    # VECTOR_STORE_API_KEY: Optional[str] = os.getenv("VECTOR_STORE_API_KEY")

    # Database
    # TODO: Configure when integrating with backend database
    # DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")

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
        if not cls.OPENAI_API_KEY:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("OPENAI_API_KEY not set - using mock LLM implementations for testing")
        
        return True


# Global config instance
config = AIConfig()
