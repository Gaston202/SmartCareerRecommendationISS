"""AI layer configuration - model settings and defaults."""
from typing import Dict, List


class AIConfig:
    """AI model configuration."""

    # Primary models for each task
    MODELS: Dict[str, str] = {
        "quiz": "nvidia/nemotron-3-super-120b-a12b:free",
        "quiz_results": "tencent/hy3-preview:free",
        "cv": "nvidia/nemotron-3-super-120b-a12b:free",
        "roadmap": "nvidia/nemotron-3-super-120b-a12b:free",
        "explanation": "nvidia/nemotron-3-super-120b-a12b:free",
    }

    # Fallback model pools
    CV_FALLBACK_MODELS: List[str] = [
        "tencent/hy3-preview:free",
        "deepseek/deepseek-r1-0528:free",
        "qwen/qwen-2.5-coder-32b:free",
        "meta-llama/llama-3.1-8b-instruct:free",
    ]

    QUIZ_FALLBACK_MODELS: List[str] = [
        "tencent/hy3-preview:free",
        "qwen/qwen-2.5-coder-32b:free",
        "meta-llama/llama-3.1-8b-instruct:free",
    ]

    QUIZ_RESULTS_FALLBACK_MODELS: List[str] = [
        "qwen/qwen-2.5-coder-32b:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
    ]

    ROADMAP_FALLBACK_MODELS: List[str] = [
        "tencent/hy3-preview:free",
        "qwen/qwen-2.5-coder-32b:free",
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