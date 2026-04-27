"""AI orchestrator - backward compatibility alias."""
from app.core.ai_orchestrator import AIOrchestrator, get_ai_service

# Alias for backward compatibility
AIOrchestratorService = AIOrchestrator


def get_ai_orchestrator_service() -> AIOrchestrator:
    """Get AI orchestrator instance (backward compatibility)."""
    return get_ai_service()