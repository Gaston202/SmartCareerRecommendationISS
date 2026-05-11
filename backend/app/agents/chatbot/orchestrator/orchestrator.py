"""Independent ChatbotOrchestrator - coordination layer separate from execution.

Implements the 6-phase processing pipeline:
  1. VALIDATE (safety checks, rate limits, token budget)
  2. CONTEXT (retrieve layered memory)
  3. EXECUTE (delegate to LangGraph with defense wrappers)
  4. MEMORY (update three-layer memory)
  5. TRACE (structured observability logging)
  6. RESPOND (typed response with metadata)
"""
import asyncio
import logging
import re
import time
from typing import Optional

from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import InMemorySaver

from app.agents.chatbot.graph.builder import build_chat_graph
from app.agents.chatbot.graph.state import ChatState, create_initial_state
from app.agents.chatbot.schemas.pydantic import ChatResponse, Intent
from app.agents.chatbot.orchestrator.config import (
    OrchestratorConfig, AutonomyTier,
)
from app.agents.chatbot.orchestrator.memory import MemoryManager
from app.agents.chatbot.orchestrator.defense import DefenseManager
from app.agents.chatbot.orchestrator.trace import ExecutionTrace
from app.core.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)


class OrchestratorError(Exception):
    """Errors raised by the orchestrator (not by graph execution)."""


class CircuitBreakerError(OrchestratorError):
    """Raised when token budget is exhausted."""


class PoisonPillError(OrchestratorError):
    """Raised when systemic failure pattern detected."""


def estimated_tokens(text: str) -> int:
    """Rough token estimation: ~4 chars per token."""
    return max(1, len(text) // 4)


class ChatbotOrchestrator:
    """Independent orchestrator for chatbot conversations.

    Separates coordination (what to do, who does it, safety enforcement)
    from execution (the LangGraph). The orchestrator does NOT call LLMs
    directly — it delegates all LLM work to the graph.

    Usage:
        orchestrator = ChatbotOrchestrator(ai=AIOrchestrator())
        response = await orchestrator.process(user_id, "hello", thread_id)
    """

    def __init__(
        self,
        ai: AIOrchestrator,
        config: Optional[OrchestratorConfig] = None,
        memory: Optional[MemoryManager] = None,
        defense: Optional[DefenseManager] = None,
    ):
        self._ai = ai
        self.config = config or OrchestratorConfig()
        self.memory = memory or MemoryManager(
            window_size=self.config.working_memory_window,
            summary_trigger=self.config.summary_trigger_count,
        )
        self.defense = defense or DefenseManager(
            token_budget_limit=self.config.token_budget_per_thread,
            token_warn_threshold=self.config.token_warn_threshold,
            loop_similarity_threshold=self.config.loop_similarity_threshold,
            max_loop_repeats=self.config.max_loop_repeats,
            timeout_s=self.config.per_node_timeout_s,
        )
        self._graph = None

    @property
    def graph(self):
        """Lazy compilation of the LangGraph execution engine."""
        if self._graph is None:
            builder = build_chat_graph(orchestrator=self._ai)
            self._graph = builder.compile(checkpointer=InMemorySaver())
        return self._graph

    async def process(
        self,
        user_id: str,
        message: str,
        thread_id: Optional[str] = None,
    ) -> ChatResponse:
        """Process a user message through the 6-phase pipeline.

        Args:
            user_id: Authenticated user identifier.
            message: Raw user input text.
            thread_id: Conversation thread (defaults to user_{user_id}).

        Returns:
            ChatResponse with assistant reply, intent, and metadata.
        """
        thread_id = thread_id or f"user_{user_id}"
        trace = ExecutionTrace(
            user_id=user_id,
            thread_id=thread_id,
        )
        t_start = time.monotonic()

        try:
            # ── Phase 1: VALIDATE ──────────────────────────────
            self._validate_input(message)

            # ── Phase 2: CONTEXT ───────────────────────────────
            state = self._build_state(user_id, thread_id, message)

            # ── Phase 3: EXECUTE ───────────────────────────────
            result = await self._execute_graph(state, thread_id, trace)

            # ── Phase 4: MEMORY ────────────────────────────────
            self._update_memory(
                thread_id, user_id, message,
                result, trace,
            )

            # ── Phase 5: TRACE ─────────────────────────────────
            trace.total_latency_ms = (time.monotonic() - t_start) * 1000
            self._log_trace(trace)

            # ── Phase 6: RESPOND ───────────────────────────────
            return self._build_response(result, thread_id)

        except CircuitBreakerError:
            return ChatResponse(
                message="I've reached the limit for this conversation. Please reset or start a new thread.",
                intent=Intent.UNKNOWN,
                action_taken=None,
                data={"error": "token_budget_breached"},
            )
        except PoisonPillError:
            return ChatResponse(
                message=(
                    "Something's not working right. Please try resetting the "
                    "conversation or try again later."
                ),
                intent=Intent.UNKNOWN,
                action_taken=None,
                data={"error": "service_degraded"},
            )
        except asyncio.TimeoutError:
            trace.error = "timeout"
            trace.total_latency_ms = (time.monotonic() - t_start) * 1000
            self._log_trace(trace)
            return ChatResponse(
                message="That took too long to process. Could you try a simpler question?",
                intent=Intent.UNKNOWN,
                action_taken=None,
                data={"error": "timeout"},
            )
        except Exception as exc:
            trace.error = f"{type(exc).__name__}: {str(exc)[:200]}"
            trace.total_latency_ms = (time.monotonic() - t_start) * 1000
            self._log_trace(trace)
            logger.error("Orchestrator error: %s", trace.error, exc_info=True)
            return ChatResponse(
                message=self.config.fallback_message,
                intent=Intent.UNKNOWN,
                action_taken=None,
                data={"error": trace.error},
            )

    async def reset(self, user_id: str, thread_id: Optional[str] = None) -> bool:
        """Reset conversation state for a user thread."""
        thread_id = thread_id or f"user_{user_id}"
        try:
            self.memory.clear_thread(thread_id)
            self.defense.reset_thread()
            if self._graph:
                config = {"configurable": {"thread_id": thread_id}}
                try:
                    self._graph.checkpointer.delete(config)
                except Exception:
                    pass
            logger.info("Conversation reset: user=%s thread=%s", user_id, thread_id)
            return True
        except Exception as exc:
            logger.error("Reset failed: %s", exc)
            return False

    def get_history(
        self, user_id: str, thread_id: Optional[str] = None
    ) -> list[dict]:
        """Get conversation history for a thread."""
        thread_id = thread_id or f"user_{user_id}"
        dialog = self.memory.recent_dialog(thread_id, n=50)
        return [{"role": m["role"], "content": m["content"]} for m in dialog]

    # ── Private: Phase implementations ────────────────────────

    def _validate_input(self, message: str):
        if not message or not message.strip():
            raise OrchestratorError("Empty message")

        message = message.strip()

        if len(message) > self.config.max_message_length:
            raise OrchestratorError("Message too long")

        lower = message.lower()
        for pattern in self.config.profanity_patterns:
            if re.search(rf'\b{re.escape(pattern)}\b', lower):
                raise OrchestratorError("Message contains profanity")

        if not self.defense.token_budget.consume(estimated_tokens(message)):
            raise CircuitBreakerError("Token budget exhausted")

        if self.defense.poison_pill.is_poisoned:
            raise PoisonPillError("Service degraded by poison pill detection")

    def _build_state(
        self, user_id: str, thread_id: str, message: str
    ) -> dict:
        initial = create_initial_state(user_id=user_id, thread_id=thread_id)
        dialog = self.memory.recent_dialog(thread_id)
        for m in dialog:
            if m["role"] == "user":
                initial["messages"].append(HumanMessage(content=m["content"]))
            else:
                initial["messages"].append(AIMessage(content=m["content"]))
        initial["messages"].append(HumanMessage(content=message))
        return dict(initial)

    async def _execute_graph(
        self, state: dict, thread_id: str, trace: ExecutionTrace
    ) -> dict:
        config = {"configurable": {"thread_id": thread_id}}

        try:
            result = await asyncio.wait_for(
                self.graph.ainvoke(state, config),
                timeout=self.defense.timeout_s,
            )
        except asyncio.TimeoutError:
            logger.error("graph_invoke timed out after %.1fs for thread=%s", self.defense.timeout_s, thread_id)
            raise

        warning = self.defense.check_response(
            self._last_ai_content(result)
        )
        if warning:
            trace.warning = warning
            logger.warning("Defense warning for thread=%s: %s", thread_id, warning)

        trace.intent = str(result.get("current_intent", "unknown"))
        trace.routing_path = self._extract_path(result)
        trace.tools_called = [
            t for t in [result.get("last_tool_used")]
            if t
        ]
        tier = self.config.tier_for_intent(trace.intent)
        trace.tier = self.config.tier_label(tier)
        trace.token_budget_used = self.defense.token_budget.used
        trace.token_budget_limit = self.defense.token_budget.limit

        return result

    def _update_memory(
        self, thread_id: str, user_id: str,
        message: str, result: dict, trace: ExecutionTrace,
    ):
        assistant_msg = self._last_ai_content(result)
        self.memory.add_turn(
            thread_id=thread_id,
            user_id=user_id,
            user_msg=message,
            assistant_msg=assistant_msg,
            intent=trace.intent,
        )

        if self.memory.should_summarize(thread_id):
            self._trigger_summarization(thread_id)

        self.defense.record_success()

    def _build_response(self, result: dict, thread_id: str) -> ChatResponse:
        response_message = self._last_ai_content(result)
        intent = result.get("current_intent", Intent.UNKNOWN)
        action_taken = result.get("last_tool_used")

        booking_session_id = None
        booking_data = result.get("booking_data")
        if result.get("confirmed") and booking_data:
            if hasattr(booking_data, 'session_id'):
                booking_session_id = booking_data.session_id
            elif isinstance(booking_data, dict):
                booking_session_id = booking_data.get("session_id")

        search_data = result.get("search_data") or {}
        return ChatResponse(
            message=response_message,
            action_taken=action_taken,
            data={
                "thread_id": thread_id,
                "booking_confirmed": result.get("confirmed", False),
                "search_results_count": len(search_data.get("results", [])),
            },
            intent=Intent(intent) if isinstance(intent, str) else intent,
            session_id=booking_session_id,
        )

    # ── Helpers ───────────────────────────────────────────────

    @staticmethod
    def _last_ai_content(result: dict) -> str:
        messages = result.get("messages", [])
        if not messages:
            return "I'm not sure how to respond. Could you rephrase?"
        last = messages[-1]
        if isinstance(last, AIMessage):
            return last.content
        if hasattr(last, 'content'):
            return last.content
        return str(last)

    @staticmethod
    def _extract_path(result: dict) -> list[str]:
        path = ["router"]
        intent = str(result.get("current_intent", ""))
        if intent == "booking":
            stage = result.get("booking_stage", "")
            last_tool = result.get("last_tool_used", "")
            path.append(f"booking({stage or last_tool or 'clarify'})")
        elif intent in ("search", "career_info"):
            path.append(intent)
            if result.get("last_tool_used"):
                path.append("format_answer")
        elif intent:
            path.append(intent)
        return path

    def _trigger_summarization(self, thread_id: str):
        try:
            dialog = self.memory.recent_dialog(thread_id, n=20)
            text = "\n".join(
                f"{m['role']}: {m['content'][:300]}"
                for m in dialog
            )
            summary = f"Conversation with {len(dialog)} turns. "
            summary += f"Topics discussed: {text[:500]}..."
            self.memory.update_summary(thread_id, summary)
        except Exception as exc:
            logger.warning("Summarization failed: %s", exc)

    def _log_trace(self, trace: ExecutionTrace):
        if self.config.trace_log_enabled:
            logger.info("TRACE %s", trace.summary())


# ── Singleton ─────────────────────────────────────────────────

_orchestrator_instance: Optional[ChatbotOrchestrator] = None


def get_chatbot_orchestrator(
    ai: Optional[AIOrchestrator] = None,
) -> ChatbotOrchestrator:
    """Get or create the singleton orchestrator instance."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        if ai is None:
            ai = AIOrchestrator()
        _orchestrator_instance = ChatbotOrchestrator(ai=ai)
    return _orchestrator_instance


