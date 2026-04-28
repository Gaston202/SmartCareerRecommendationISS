"""AI layer configuration - model settings and defaults."""
from typing import Dict, List


class AIConfig:
    """AI model configuration."""

    # Primary models for each task
    # Using openrouter/free router which auto-selects models that support required features
    MODELS: Dict[str, str] = {
        "quiz": "openrouter/free",
        "quiz_results": "openrouter/free",
        "cv": "openrouter/free",
        "roadmap": "openrouter/free",
        "explanation": "openrouter/free",
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

    @classmethod
    def get_models(cls, task: str) -> List[str]:
        """Get model list for a task (primary + fallbacks)."""
        primary = cls.MODELS.get(task, cls.MODELS["quiz"])
        
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