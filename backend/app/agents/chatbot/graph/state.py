from typing import TypedDict, Annotated, Literal
from langgraph.graph import add_messages
from app.agents.chatbot.schemas.pydantic import Intent, BookingContext, SearchContext


class ChatState(TypedDict):
    """LangGraph state for the chatbot agent."""

    messages: Annotated[list, add_messages]

    current_intent: Intent

    booking_data: BookingContext | None
    search_data: SearchContext | None

    confirmation_needed: bool
    confirmed: bool

    user_id: str | None
    thread_id: str | None

    last_tool_used: str | None
    error_message: str | None

    booking_stage: str | None
    compound_greeting: bool
    conversation_summary: str | None


def create_initial_state(user_id: str | None = None, thread_id: str | None = None) -> ChatState:
    """Factory function to create initial state."""
    return ChatState(
        messages=[],
        current_intent=Intent.UNKNOWN,
        booking_data=None,
        search_data=None,
        confirmation_needed=False,
        confirmed=False,
        user_id=user_id,
        thread_id=thread_id,
        last_tool_used=None,
        error_message=None,
        booking_stage=None,
        compound_greeting=False,
        conversation_summary=None,
    )