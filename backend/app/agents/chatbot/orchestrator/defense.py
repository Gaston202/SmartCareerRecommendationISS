"""Defense-in-depth mechanisms for orchestrator safety.

Implements: LoopDetector, TokenBudget, TimeoutGuard, PoisonPillDetector.
Prevents cascading failures per production best practices.
"""
import asyncio
import logging
import re
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class LoopDetector:
    """Detects infinite loops via output similarity checking."""

    threshold: float = 0.92
    window_size: int = 3
    max_repeats: int = 3
    _history: list[str] = field(default_factory=list)
    _repeats_detected: int = 0

    def _jaccard_similarity(self, a: str, b: str) -> float:
        set_a = set(a.lower().split())
        set_b = set(b.lower().split())
        if not set_a or not set_b:
            return 0.0
        intersection = set_a & set_b
        union = set_a | set_b
        return len(intersection) / len(union) if union else 0.0

    def check(self, response_text: str) -> bool:
        """Returns True if a loop is detected."""
        self._history.append(response_text)
        if len(self._history) < self.window_size:
            return False

        recent = self._history[-self.window_size:]
        for i in range(len(recent) - 1):
            sim = self._jaccard_similarity(recent[i], recent[-1])
            if sim >= self.threshold:
                self._repeats_detected += 1
                if self._repeats_detected >= self.max_repeats:
                    logger.warning(
                        "Loop detected: %s repeats, similarity=%.3f",
                        self._repeats_detected, sim,
                    )
                    return True
            else:
                self._repeats_detected = 0

        return False

    def reset(self):
        self._history = []
        self._repeats_detected = 0


@dataclass
class TokenBudget:
    """Tracks token usage with circuit breaker."""

    limit: int = 32000
    warn_threshold: float = 0.80
    _used: int = 0
    _breached: bool = False

    @property
    def used(self) -> int:
        return self._used

    @property
    def remaining(self) -> int:
        return max(0, self.limit - self._used)

    @property
    def is_breached(self) -> bool:
        return self._breached

    def consume(self, tokens: int) -> bool:
        """Returns False if budget is breached."""
        self._used += tokens
        if self._used >= self.limit:
            self._breached = True
            logger.warning("Token budget breached: %s/%s", self._used, self.limit)
            return False
        if self._used >= self.limit * self.warn_threshold:
            logger.info("Token budget warning: %s/%s", self._used, self.limit)
        return True

    def reset(self):
        self._used = 0
        self._breached = False


@asynccontextmanager
async def TimeoutGuard(timeout_s: float = 30.0, label: str = "operation"):
    """Async context manager that enforces a hard timeout."""
    start = time.monotonic()
    try:
        task = asyncio.current_task()
        if task is None:
            yield
            return

        loop = asyncio.get_running_loop()
        future = loop.create_future()

        def _on_timeout():
            if not future.done():
                future.set_exception(asyncio.TimeoutError(
                    f"{label} timed out after {timeout_s}s"
                ))

        handle = loop.call_later(timeout_s, _on_timeout)
        try:
            yield
        finally:
            handle.cancel()
    except asyncio.TimeoutError:
        elapsed = time.monotonic() - start
        logger.error("TimeoutGuard: %s timed out after %.1fs", label, elapsed)
        raise
    except Exception:
        elapsed = time.monotonic() - start
        logger.error("TimeoutGuard: %s failed after %.1fs", label, elapsed)
        raise


@dataclass
class PoisonPillDetector:
    """Detects repeated failure patterns that indicate systemic issues."""

    max_consecutive_errors: int = 5
    _error_count: int = 0
    _last_error_types: list[str] = field(default_factory=list)
    _is_poisoned: bool = False

    def record_error(self, error_type: str) -> bool:
        """Returns True if poison pill is detected."""
        self._error_count += 1
        self._last_error_types.append(error_type)
        if len(self._last_error_types) > 10:
            self._last_error_types = self._last_error_types[-10:]

        if self._error_count >= self.max_consecutive_errors:
            last_few = self._last_error_types[-5:]
            if len(set(last_few)) <= 2:
                self._is_poisoned = True
                logger.critical(
                    "Poison pill detected: %s consecutive errors, "
                    "repeating types: %s",
                    self._error_count, last_few,
                )
                return True

        return False

    def record_success(self):
        self._error_count = 0

    @property
    def is_poisoned(self) -> bool:
        return self._is_poisoned

    def reset(self):
        self._error_count = 0
        self._last_error_types = []
        self._is_poisoned = False


class DefenseManager:
    """Coordinates all defense mechanisms."""

    def __init__(
        self,
        token_budget_limit: int = 32000,
        token_warn_threshold: float = 0.80,
        loop_similarity_threshold: float = 0.92,
        max_loop_repeats: int = 3,
        timeout_s: float = 30.0,
        max_consecutive_errors: int = 5,
    ):
        self.loop_detector = LoopDetector(
            threshold=loop_similarity_threshold,
            max_repeats=max_loop_repeats,
        )
        self.token_budget = TokenBudget(
            limit=token_budget_limit,
            warn_threshold=token_warn_threshold,
        )
        self.timeout_s = timeout_s
        self.poison_pill = PoisonPillDetector(
            max_consecutive_errors=max_consecutive_errors,
        )

    def timeout_guard(self, label: str = "graph_invoke"):
        return TimeoutGuard(timeout_s=self.timeout_s, label=label)

    def check_response(self, text: str) -> Optional[str]:
        """Post-execution safety check. Returns warning string or None."""
        if self.loop_detector.check(text):
            return "loop_detected"
        return None

    def record_error(self, error_type: str) -> bool:
        return self.poison_pill.record_error(error_type)

    def record_success(self):
        self.poison_pill.record_success()

    def reset_thread(self):
        self.loop_detector.reset()
        self.token_budget.reset()
        self.poison_pill.reset()
