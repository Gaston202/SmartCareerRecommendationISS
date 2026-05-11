"""Chatbot service — thin backward-compatible wrapper around ChatbotOrchestrator.

All coordination logic lives in the orchestrator. This service provides
a stable public API for routers and other consumers.
"""
import logging
from typing import Optional

from app.agents.chatbot.orchestrator.orchestrator import (
    ChatbotOrchestrator,
    get_chatbot_orchestrator,
)
from app.agents.chatbot.orchestrator.trace import ExecutionTrace
from app.agents.chatbot.schemas.pydantic import ChatResponse
from app.core.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)


class ChatbotService:
    """Thin wrapper around ChatbotOrchestrator for backward compatibility."""

    def __init__(self, ai_orchestrator: Optional[AIOrchestrator] = None):
        ai = ai_orchestrator or AIOrchestrator()
        self._orchestrator = ChatbotOrchestrator(ai=ai)

    @property
    def orchestrator(self) -> ChatbotOrchestrator:
        return self._orchestrator

    async def process_message(
        self,
        user_id: str,
        message: str,
        thread_id: Optional[str] = None,
    ) -> ChatResponse:
        return await self._orchestrator.process(user_id, message, thread_id)

    async def reset_conversation(
        self, user_id: str, thread_id: Optional[str] = None
    ) -> bool:
        return await self._orchestrator.reset(user_id, thread_id)

    def get_conversation_history(
        self, user_id: str, thread_id: Optional[str] = None
    ) -> list[dict]:
        return self._orchestrator.get_history(user_id, thread_id)


_chatbot_service_instance: Optional[ChatbotService] = None


def get_chatbot_service(
    ai_orchestrator: Optional[AIOrchestrator] = None,
) -> ChatbotService:
    """Get or create the singleton chatbot service instance."""
    global _chatbot_service_instance
    if _chatbot_service_instance is None:
        _chatbot_service_instance = ChatbotService(ai_orchestrator=ai_orchestrator)
    return _chatbot_service_instance
