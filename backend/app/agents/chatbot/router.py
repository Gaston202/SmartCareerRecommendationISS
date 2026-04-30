"""Chatbot API routes with structured trace logging."""
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
import jwt

from app.agents.chatbot.service import ChatbotService, get_chatbot_service
from app.agents.chatbot.schemas.pydantic import ChatResponse
from app.core.ai_orchestrator import AIOrchestrator
from app.core.dependencies import get_ai_orchestrator_service

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

logger = logging.getLogger(__name__)


def get_user_id_from_token(authorization: Optional[str] = None) -> str:
    """Extract user ID from JWT token in Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format. Use: Bearer <token>",
        )

    token = parts[1]
    try:
        payload = jwt.decode(
            token,
            options={"verify_signature": False},
            algorithms=["HS256", "RS256"],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        return user_id
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token format")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/message")
async def send_message(
    message: str,
    thread_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    service: ChatbotService = Depends(
        lambda: get_chatbot_service(
            ai_orchestrator=get_ai_orchestrator_service()
        )
    ),
) -> ChatResponse:
    """
    Send a message to the chatbot.

    Processed through the independent ChatbotOrchestrator with
    defense-in-depth, layered memory, and trace logging.
    """
    t0 = time.monotonic()
    user_id = get_user_id_from_token(authorization)

    response = await service.process_message(user_id, message, thread_id)

    elapsed_ms = (time.monotonic() - t0) * 1000
    logger.info(
        "API /chatbot/message user=%s intent=%s latency=%.0fms snippet=%.60s",
        user_id,
        response.intent.value if hasattr(response.intent, 'value') else response.intent,
        elapsed_ms,
        message,
    )
    return response


@router.post("/reset")
async def reset_conversation(
    thread_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    service: ChatbotService = Depends(
        lambda: get_chatbot_service(
            ai_orchestrator=get_ai_orchestrator_service()
        )
    ),
) -> dict:
    """Reset the conversation state for the current user."""
    user_id = get_user_id_from_token(authorization)
    success = await service.reset_conversation(user_id, thread_id)
    if success:
        return {"success": True, "message": "Conversation reset successfully"}
    return {"success": False, "message": "Failed to reset conversation"}


@router.get("/history")
async def get_conversation_history(
    thread_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    service: ChatbotService = Depends(
        lambda: get_chatbot_service(
            ai_orchestrator=get_ai_orchestrator_service()
        )
    ),
) -> dict:
    """Get the conversation history for the current user."""
    user_id = get_user_id_from_token(authorization)
    history = service.get_conversation_history(user_id, thread_id)
    return {"success": True, "history": history, "count": len(history)}


@router.get("/trace/{thread_id}")
async def get_trace_info(
    thread_id: str,
    authorization: Optional[str] = Header(None),
    service: ChatbotService = Depends(
        lambda: get_chatbot_service(
            ai_orchestrator=get_ai_orchestrator_service()
        )
    ),
) -> dict:
    """Get trace-level debugging info for a conversation thread."""
    user_id = get_user_id_from_token(authorization)
    history = service.get_conversation_history(user_id, thread_id)

    memory = service.orchestrator.memory
    summary = memory.get_summary(thread_id)
    defense = service.orchestrator.defense

    return {
        "thread_id": thread_id,
        "user_id": user_id,
        "message_count": len(history),
        "summary": summary or "No summary yet",
        "token_budget_used": defense.token_budget.used,
        "token_budget_limit": defense.token_budget.limit,
        "token_budget_breached": defense.token_budget.is_breached,
        "loop_repeats_detected": defense.loop_detector._repeats_detected,
        "poison_pill_active": defense.poison_pill.is_poisoned,
    }


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint for the chatbot service."""
    return {
        "status": "healthy",
        "service": "chatbot",
        "version": "3.0.0",
        "orchestrator": "independent",
    }
