"""AI layer configuration - model settings and defaults."""
from typing import Dict, List

from app.core.config import settings


class AIConfig:
    """AI model configuration."""

    # Primary models for each task
    # Note: chatbot uses Ollama Cloud exclusively (no OpenRouter fallback)
    MODELS: Dict[str, str] = {
        "quiz": "openrouter/free",
        "quiz_results": "openrouter/free",
        "cv": "openrouter/free",
        "roadmap": "openrouter/free",
        "explanation": "openrouter/free",
        "chatbot": settings.ollama_chatbot_model,
    }

    # Fallback model pools (specific models if router is unavailable)
    CV_FALLBACK_MODELS: List[str] = [
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "google/gemma-3-4b-it:free",
    ]

    QUIZ_FALLBACK_MODELS: List[str] = [
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "mistralai/mistral-7b-instruct:free",
    ]

    QUIZ_RESULTS_FALLBACK_MODELS: List[str] = [
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "mistralai/mistral-7b-instruct:free",
    ]

    ROADMAP_FALLBACK_MODELS: List[str] = [
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "google/gemma-3-4b-it:free",
    ]

    # Chatbot uses Ollama Cloud exclusively — OpenRouter fallbacks removed per design

    # Tier-specific model configs for orchestrator-tiered autonomy
    TIER_MODEL_CONFIGS = {
        0: {"temperature": 0.3, "max_tokens": 400},   # INFO_LOOKUP: cold, concise
        1: {"temperature": 0.5, "max_tokens": 600},   # RECOMMENDATION: balanced
        2: {"temperature": 0.7, "max_tokens": 800},   # BOUNDED_EXECUTION: warmer
        3: {"temperature": 0.3, "max_tokens": 300},   # REQUIRES_APPROVAL: strict
    }

    @classmethod
    def get_models(cls, task: str) -> List[str]:
        """Get model list for a task (primary + fallbacks)."""
        primary = cls.MODELS.get(task, cls.MODELS["quiz"])

        # Chatbot uses Ollama Cloud exclusively — no OpenRouter fallback
        if task == "chatbot":
            return [primary]

        if task == "cv":
            return [primary] + cls.CV_FALLBACK_MODELS
        elif task == "quiz":
            return [primary] + cls.QUIZ_FALLBACK_MODELS
        elif task == "quiz_results":
            return [primary] + cls.QUIZ_RESULTS_FALLBACK_MODELS
        elif task == "roadmap":
            return [primary] + cls.ROADMAP_FALLBACK_MODELS
        else:
            return [primary] + cls.QUIZ_FALLBACK_MODELS

    @classmethod
    def get_tier_config(cls, tier: int) -> dict:
        """Get model config for an autonomy tier.

        Args:
            tier: AutonomyTier value (0-3).

        Returns:
            Dict with temperature and max_tokens for that tier.
        """
        return cls.TIER_MODEL_CONFIGS.get(
            tier, {"temperature": 0.5, "max_tokens": 500}
        )