"""Build the chatbot LangGraph state graph.

Returns an uncompiled builder — the orchestrator handles compilation,
checkpointer injection, and lifecycle management per best practices
(control plane / data plane separation).
"""
from typing import Literal
from functools import partial
from langgraph.graph import StateGraph, START, END

from app.agents.chatbot.graph.state import ChatState
from app.agents.chatbot.graph.nodes.router import llm_router_node
from app.agents.chatbot.graph.nodes.booking import (
    booking_clarify_node,
    booking_availability_node,
    booking_execute_node,
    booking_response_node,
)
from app.agents.chatbot.graph.nodes.qa import search_node, format_answer_node, career_info_node
from app.agents.chatbot.graph.nodes.llm_response import llm_response_node
from app.agents.chatbot.graph.nodes.general import (
    greeting_node,
    help_node,
    fallback_node,
    user_sessions_node,
    explain_feature_node,
)
from app.agents.chatbot.graph.nodes.profile import profile_node
from app.agents.chatbot.schemas.pydantic import Intent
from app.core.ai_orchestrator import AIOrchestrator


VALID_ROUTES = {
    "greeting", "help", "search", "booking", "career_info",
    "user_sessions", "explain_feature", "profile", "fallback", "general",
    "confirmation", "unknown",
}


def route_after_router(state: ChatState) -> str:
    """Route to appropriate node based on current_intent from router output."""
    intent = state.get("current_intent", Intent.UNKNOWN)
    intent_str = intent.value if hasattr(intent, 'value') else str(intent)

    if intent_str not in VALID_ROUTES:
        logger.warning(f"Unknown intent '{intent_str}', falling back to general")
        return "general"

    return intent_str


def route_after_booking_clarify(state: ChatState) -> str:
    """Route within booking subgraph based on clarify action result."""
    last_tool = state.get("last_tool_used", "ask_clarification")
    if last_tool == "show_mentors":
        return "booking_availability"
    elif last_tool == "ready_to_book":
        return "booking_execute"
    else:
        return "end_booking"


def should_format_answer(state: ChatState) -> str:
    """After search, should we format answer or search more?"""
    if state.get("last_tool_used") == "web_search":
        return "format_answer"
    return "search"


def build_chat_graph(orchestrator: AIOrchestrator | None = None) -> StateGraph:
    """
    Build the chatbot LangGraph state graph (uncompiled).

    The orchestrator handles compilation, checkpointer injection, and
    lifecycle management. This separation keeps the graph as a pure
    execution engine.

    Graph flow:
    - START -> router (LLM-based intent classification + entity extraction)
    - router -> routes to specific handler based on current_intent
    - greeting -> greeting_node -> END
    - help -> help_node -> END
    - search path: search -> (conditional) format_answer (with LLM synthesis) -> END
    - booking subgraph:
        booking_clarify (LLM slot-filling)
          ├─ ask_clarification → END
          ├─ show_mentors → booking_availability → booking_response → END
          └─ ready_to_book → booking_execute → booking_response → END
    - career_info path: career_info -> llm_response -> END
    - user_sessions path: user_sessions -> llm_response -> END
    - explain_feature path: explain_feature -> llm_response -> END
    - general/fallback/unknown path: llm_response -> END

    Args:
        orchestrator: Optional AIOrchestrator for LLM calls in graph nodes.

    Returns:
        Uncompiled StateGraph builder (call .compile(checkpointer=...) to use)
    """
    builder = StateGraph(ChatState)

    # Router: LLM-based intent classification
    builder.add_node("router", partial(llm_router_node, orchestrator=orchestrator))

    # Booking subgraph: 4 specialized nodes
    builder.add_node("booking_clarify", partial(booking_clarify_node, orchestrator=orchestrator))
    builder.add_node("booking_availability", booking_availability_node)
    builder.add_node("booking_execute", booking_execute_node)
    builder.add_node("booking_response", booking_response_node)

    # Search: keep search tool, then LLM synthesis
    builder.add_node("search", search_node)
    builder.add_node("format_answer", partial(format_answer_node, orchestrator=orchestrator))

    # Career info: tool search then LLM synthesis
    builder.add_node("career_info", career_info_node)

    # Profile: user's own data
    builder.add_node("profile", profile_node)

    # General response: LLM-powered
    builder.add_node("llm_response", partial(llm_response_node, orchestrator=orchestrator))

    # Specialized nodes (now reachable)
    builder.add_node("greeting", greeting_node)
    builder.add_node("help", help_node)
    builder.add_node("fallback", fallback_node)
    builder.add_node("user_sessions", user_sessions_node)
    builder.add_node("explain_feature", explain_feature_node)

    # --- Edges ---

    builder.add_edge(START, "router")

    builder.add_conditional_edges(
        "router",
        route_after_router,
        {
            "greeting": "greeting",
            "help": "help",
            "general": "llm_response",
            "booking": "booking_clarify",
            "confirmation": "booking_clarify",
            "search": "search",
            "career_info": "career_info",
            "user_sessions": "user_sessions",
            "explain_feature": "explain_feature",
            "profile": "profile",
            "fallback": "llm_response",
            "unknown": "llm_response",
        }
    )

    # Booking subgraph routing
    builder.add_conditional_edges(
        "booking_clarify",
        route_after_booking_clarify,
        {
            "booking_availability": "booking_availability",
            "booking_execute": "booking_execute",
            "end_booking": END,
        }
    )
    builder.add_edge("booking_availability", "booking_response")
    builder.add_edge("booking_execute", "booking_response")
    builder.add_edge("booking_response", END)

    # Search flow: search -> format_answer -> END
    builder.add_conditional_edges(
        "search",
        should_format_answer,
        {
            "format_answer": "format_answer",
            "search": "search"
        }
    )
    builder.add_edge("format_answer", END)

    # Career info -> llm_response -> END
    builder.add_edge("career_info", "llm_response")

    # User sessions -> llm_response -> END
    builder.add_edge("user_sessions", "llm_response")

    # Explain feature -> llm_response -> END
    builder.add_edge("explain_feature", "llm_response")

    # Profile -> llm_response -> END (reuse LLM synthesis for rich responses)
    builder.add_edge("profile", "llm_response")

    # General response nodes
    builder.add_edge("llm_response", END)
    builder.add_edge("greeting", END)
    builder.add_edge("help", END)
    builder.add_edge("fallback", END)

    return builder


def create_graph_with_memory():
    """Create graph builder (uncompiled)."""
    return build_chat_graph()


import logging
logger = logging.getLogger(__name__)
