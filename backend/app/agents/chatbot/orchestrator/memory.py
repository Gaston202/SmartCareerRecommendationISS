"""Layered memory system for chatbot conversations.

Three layers per best practices:
- ShortTermMemory: current turn (cleared each message)
- WorkingMemory: thread-level sliding window + summary
- LongTermMemory: Supabase-backed persistent user facts
"""
import logging
from typing import Optional
from datetime import datetime, timezone
from collections import deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ShortTermMemory:
    current_input: str = ""
    extracted_entities: dict = field(default_factory=dict)
    last_response: str = ""
    intent: str = ""

    def clear(self):
        self.current_input = ""
        self.extracted_entities = {}
        self.last_response = ""
        self.intent = ""


@dataclass
class WorkingMemory:
    thread_id: str = ""
    user_id: str = ""
    messages: deque = field(default_factory=lambda: deque(maxlen=20))
    summary: str = ""
    turns: int = 0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_accessed: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def add_message(self, role: str, content: str):
        self.messages.append({
            "role": role,
            "content": content[:2000],
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        self.turns += 1
        self.last_accessed = datetime.now(timezone.utc).isoformat()

    def recent_dialog(self, n: int = 10) -> list[dict]:
        items = list(self.messages)
        return items[-n:]

    def needs_summarization(self, trigger_count: int = 12) -> bool:
        return self.turns > 0 and self.turns % trigger_count == 0


@dataclass
class LongTermMemory:
    user_id: str = ""
    facts: dict = field(default_factory=dict)
    preferences: dict = field(default_factory=dict)
    career_interests: list = field(default_factory=list)
    past_bookings: list = field(default_factory=list)
    last_synced: Optional[str] = None


class MemoryManager:
    """Manages three-layer memory for chatbot conversations."""

    def __init__(self, window_size: int = 10, summary_trigger: int = 12):
        self._short_term: dict[str, ShortTermMemory] = {}
        self._working: dict[str, WorkingMemory] = {}
        self._long_term: dict[str, LongTermMemory] = {}
        self.window_size = window_size
        self.summary_trigger = summary_trigger

    def get_or_create_short_term(self, thread_key: str) -> ShortTermMemory:
        if thread_key not in self._short_term:
            self._short_term[thread_key] = ShortTermMemory()
        return self._short_term[thread_key]

    def get_or_create_working(
        self, thread_id: str, user_id: str = ""
    ) -> WorkingMemory:
        key = thread_id
        if key not in self._working:
            self._working[key] = WorkingMemory(
                thread_id=thread_id,
                user_id=user_id,
            )
        return self._working[key]

    def get_or_create_long_term(self, user_id: str) -> LongTermMemory:
        if user_id not in self._long_term:
            self._long_term[user_id] = LongTermMemory(user_id=user_id)
        return self._long_term[user_id]

    def add_turn(
        self, thread_id: str, user_id: str,
        user_msg: str, assistant_msg: str, intent: str = ""
    ):
        thread_key = thread_id
        short = self.get_or_create_short_term(thread_key)
        short.current_input = user_msg
        short.last_response = assistant_msg
        short.intent = intent

        working = self.get_or_create_working(thread_id, user_id)
        working.add_message("user", user_msg)
        working.add_message("assistant", assistant_msg)

    def recent_dialog(self, thread_id: str, n: int | None = None) -> list[dict]:
        n = n or self.window_size
        working = self.get_or_create_working(thread_id)
        return working.recent_dialog(n)

    def should_summarize(self, thread_id: str) -> bool:
        working = self.get_or_create_working(thread_id)
        return working.needs_summarization(self.summary_trigger)

    def update_summary(self, thread_id: str, summary: str):
        working = self.get_or_create_working(thread_id)
        working.summary = summary

    def get_summary(self, thread_id: str) -> str:
        working = self._working.get(thread_id)
        return working.summary if working else ""

    def store_fact(self, user_id: str, key: str, value):
        lt = self.get_or_create_long_term(user_id)
        lt.facts[key] = value

    def get_fact(self, user_id: str, key: str, default=None):
        lt = self._long_term.get(user_id)
        return lt.facts.get(key, default) if lt else default

    def store_preference(self, user_id: str, key: str, value):
        lt = self.get_or_create_long_term(user_id)
        lt.preferences[key] = value

    def get_preferences(self, user_id: str) -> dict:
        lt = self._long_term.get(user_id)
        return dict(lt.preferences) if lt else {}

    def clear_thread(self, thread_id: str):
        self._short_term.pop(thread_id, None)
        self._working.pop(thread_id, None)
        logger.info("Memory cleared for thread=%s", thread_id)

    def clear_all(self, user_id: str):
        keys_to_clear = [
            k for k, v in self._working.items()
            if v.user_id == user_id
        ]
        for key in keys_to_clear:
            self.clear_thread(key)
        self._long_term.pop(user_id, None)
