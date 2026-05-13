"""Orchestrator configuration with defense and autonomy settings."""
from dataclasses import dataclass, field
from enum import IntEnum


class AutonomyTier(IntEnum):
    """Tiered autonomy levels per Anthropic best practices."""
    INFO_LOOKUP = 0
    RECOMMENDATION = 1
    BOUNDED_EXECUTION = 2
    REQUIRES_APPROVAL = 3


TIER_LABELS = {
    AutonomyTier.INFO_LOOKUP: "read_only",
    AutonomyTier.RECOMMENDATION: "recommendation",
    AutonomyTier.BOUNDED_EXECUTION: "bounded_execution",
    AutonomyTier.REQUIRES_APPROVAL: "requires_approval",
}

INTENT_TIER_MAP = {
    "greeting": AutonomyTier.INFO_LOOKUP,
    "help": AutonomyTier.INFO_LOOKUP,
    "search": AutonomyTier.INFO_LOOKUP,
    "career_info": AutonomyTier.INFO_LOOKUP,
    "explain_feature": AutonomyTier.INFO_LOOKUP,
    "general": AutonomyTier.RECOMMENDATION,
    "user_sessions": AutonomyTier.INFO_LOOKUP,
    "booking": AutonomyTier.BOUNDED_EXECUTION,
    "confirmation": AutonomyTier.REQUIRES_APPROVAL,
    "unknown": AutonomyTier.INFO_LOOKUP,
}


@dataclass
class OrchestratorConfig:
    """Configuration for the ChatbotOrchestrator."""

    max_steps: int = 10
    per_node_timeout_s: float = 60.0
    graph_timeout_s: float = 90.0
    max_message_length: int = 1000
    max_messages_per_thread: int = 100

    entropy_check_enabled: bool = True
    loop_similarity_threshold: float = 0.92
    loop_window_size: int = 3
    max_loop_repeats: int = 3

    token_budget_per_thread: int = 32000
    token_warn_threshold: float = 0.80

    working_memory_window: int = 10
    summary_trigger_count: int = 12

    rate_limit_messages_per_minute: int = 20
    rate_limit_enabled: bool = True

    long_term_memory_enabled: bool = False

    trace_log_enabled: bool = True

    default_temperature: float = 0.7
    default_max_tokens: int = 800

    fallback_message: str = (
        "Something went wrong while processing your request. "
        "Please try again or type 'help' to see what I can do."
    )

    profanity_patterns: tuple = field(default=(
        "fuck", "shit", "asshole", "bastard", "bitch", "damn",
    ))

    def tier_for_intent(self, intent: str) -> AutonomyTier:
        return INTENT_TIER_MAP.get(intent, AutonomyTier.INFO_LOOKUP)

    def tier_label(self, tier: AutonomyTier) -> str:
        return TIER_LABELS.get(tier, "unknown")
