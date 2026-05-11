"""Execution trace model for full observability."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional


@dataclass
class ModelCallRecord:
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: float = 0.0
    node_name: str = ""


@dataclass
class ExecutionTrace:
    trace_id: str = field(default_factory=lambda: uuid4().hex[:12])
    user_id: str = ""
    thread_id: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    intent: str = ""
    confidence: float = 0.0
    routing_path: list[str] = field(default_factory=list)
    model_calls: list[ModelCallRecord] = field(default_factory=list)
    tools_called: list[str] = field(default_factory=list)
    tier: str = ""
    total_latency_ms: float = 0.0
    message_snippet: str = ""
    error: Optional[str] = None
    warning: Optional[str] = None
    token_budget_used: int = 0
    token_budget_limit: int = 0

    def record_model_call(
        self, model: str, tokens_in: int, tokens_out: int,
        latency_ms: float, node_name: str = ""
    ):
        self.model_calls.append(ModelCallRecord(
            model=model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            latency_ms=latency_ms,
            node_name=node_name,
        ))

    def to_dict(self) -> dict:
        return {
            "trace_id": self.trace_id,
            "user_id": self.user_id,
            "thread_id": self.thread_id,
            "timestamp": self.timestamp,
            "intent": self.intent,
            "confidence": round(self.confidence, 3),
            "routing_path": self.routing_path,
            "model_calls": [
                {
                    "model": m.model,
                    "tokens_in": m.tokens_in,
                    "tokens_out": m.tokens_out,
                    "latency_ms": round(m.latency_ms, 1),
                    "node_name": m.node_name,
                }
                for m in self.model_calls
            ],
            "tools_called": self.tools_called,
            "tier": self.tier,
            "total_latency_ms": round(self.total_latency_ms, 1),
            "message_snippet": self.message_snippet[:80] if self.message_snippet else "",
            "error": self.error,
            "warning": self.warning,
            "token_budget_used": self.token_budget_used,
            "token_budget_limit": self.token_budget_limit,
        }

    def summary(self) -> str:
        total_tokens = sum(m.tokens_in + m.tokens_out for m in self.model_calls)
        path = " → ".join(self.routing_path) if self.routing_path else "no_path"
        return (
            f"[{self.trace_id}] intent={self.intent} conf={self.confidence:.2f} "
            f"tier={self.tier} path=({path}) llm_calls={len(self.model_calls)} "
            f"total_tokens={total_tokens} latency={self.total_latency_ms:.0f}ms"
        )
