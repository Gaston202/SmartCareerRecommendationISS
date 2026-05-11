"""LLM-powered response generation node for the chatbot."""
import logging
from typing import Dict, Any, Optional
from langchain_core.messages import AIMessage

from app.agents.chatbot.schemas.pydantic import Intent
from app.core.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a friendly, knowledgeable career assistant for a mobile app called Smart Career.
Your job is to help users with career guidance, mentor booking, skill recommendations, and job market research.

App features you can help with:
- Career matching quiz (assesses skills and personality)
- CV/resume analysis with AI feedback
- Personalized learning roadmaps for any career
- Mentor session booking with industry professionals
- Job market trends and salary information

Guidelines:
- Keep responses concise (2-4 sentences max) unless the user asks for detail.
- Use markdown for formatting when helpful.
- Be encouraging and supportive — this is a student-focused career platform.
- If you have search results or tool data in the conversation context, synthesize it naturally.
- If you don't know something, say so honestly.
- Always ask follow-up questions to keep the conversation flowing.
- Respond in the same language the user is using.
"""


def _format_messages_for_llm(state: Dict[str, Any]) -> list[Dict[str, str]]:
    """Convert LangChain message objects to dict format for the orchestrator."""
    messages = state.get("messages", [])
    formatted = [{"role": "system", "content": SYSTEM_PROMPT}]

    for msg in messages:
        role = "user"
        if hasattr(msg, "type"):
            role = msg.type if msg.type in ("human", "user", "assistant", "ai", "system") else "user"
            if role == "human":
                role = "user"
            elif role in ("ai",):
                role = "assistant"
        elif hasattr(msg, "role"):
            role = msg.role

        content = msg.content if hasattr(msg, "content") else str(msg)
        if content:
            formatted.append({"role": role, "content": content})

    # Append tool context if available
    context_parts = []

    search_data = state.get("search_data")
    if search_data and search_data.get("results"):
        context_parts.append("Search results context:")
        for i, r in enumerate(search_data["results"][:3], 1):
            context_parts.append(f"{i}. {r.get('title', '')}: {r.get('snippet', '')[:200]}")

    booking_data = state.get("booking_data")
    if booking_data:
        context_parts.append("Booking context:")
        if booking_data.get("mentor_name"):
            context_parts.append(f"Mentor: {booking_data['mentor_name']}")
        if booking_data.get("preferred_date"):
            context_parts.append(f"Date: {booking_data['preferred_date']}")
        if booking_data.get("preferred_time"):
            context_parts.append(f"Time: {booking_data['preferred_time']}")
        if booking_data.get("slots"):
            context_parts.append(f"Available slots: {len(booking_data['slots'])}")

    user_id = state.get("user_id")
    if user_id:
        context_parts.append(f"User ID: {user_id}")

    intent = state.get("current_intent")
    if intent:
        context_parts.append(f"Detected intent: {intent}")

    if context_parts:
        context = "\n".join(context_parts)
        formatted.append({"role": "system", "content": f"Additional context for this response:\n{context}"})

    return formatted


async def llm_response_node(state: Dict[str, Any], orchestrator: Optional[AIOrchestrator] = None) -> Dict[str, Any]:
    """Generate a contextual response using the LLM.

    Falls back to a static message if the LLM is unavailable.
    """
    if orchestrator is None:
        logger.warning("llm_response_node: no orchestrator available, returning fallback")
        return {
            "messages": [AIMessage(content="I'm here to help! What would you like to know about your career journey?")],
            "current_intent": state.get("current_intent", Intent.GENERAL),
        }

    try:
        messages = _format_messages_for_llm(state)
        response = await orchestrator.chat_with_retry(
            task="chatbot",
            messages=messages,
            temperature=0.7,
            max_tokens=800,
            retries=2,
        )

        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            content = "I'm not sure how to respond to that. Could you try rephrasing?"

        return {
            "messages": [AIMessage(content=content)],
            "current_intent": state.get("current_intent", Intent.GENERAL),
        }
    except Exception as e:
        logger.error(f"llm_response_node error: {e}")
        return {
            "messages": [AIMessage(content="I encountered an error. Could you try again?")],
            "current_intent": state.get("current_intent", Intent.GENERAL),
            "error_message": str(e),
        }
