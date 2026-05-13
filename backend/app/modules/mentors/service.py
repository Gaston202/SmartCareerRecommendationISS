from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.modules.mentors.repository import MentorRepository
from app.modules.mentors.schemas import (
    AvailabilityRuleInput,
    AvailableSlot,
)

SLOT_DURATION_MINUTES = 30


class MentorService:
    def __init__(self) -> None:
        self.repo = MentorRepository()

    # ------------------------------------------------------------------
    # Mentors
    # ------------------------------------------------------------------

    def list_mentors(
        self,
        specialty: Optional[str],
        min_rating: Optional[float],
        is_verified: Optional[bool],
    ) -> List[Dict[str, Any]]:
        return self.repo.get_all(specialty, min_rating, is_verified)

    def get_mentor(self, mentor_id: str) -> Optional[Dict[str, Any]]:
        return self.repo.get_by_id(mentor_id)

    def get_mentor_by_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self.repo.get_by_user_id(user_id)

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        return self.repo.get_sessions_by_user(user_id)

    def get_mentor_sessions(self, mentor_id: str) -> List[Dict[str, Any]]:
        return self.repo.get_sessions_by_mentor(mentor_id)

    def get_mentor_pending_sessions(self, mentor_id: str) -> List[Dict[str, Any]]:
        return self.repo.get_pending_sessions_by_mentor(mentor_id)

    def schedule_session(
        self,
        mentor_id: str,
        user_id: str,
        title: str,
        description: Optional[str],
        scheduled_at: str,
        duration_minutes: int,
    ) -> Dict[str, Any]:
        return self.repo.create_session({
            "mentor_id": mentor_id,
            "user_id": user_id,
            "title": title,
            "description": description,
            "scheduled_at": scheduled_at,
            "duration_minutes": duration_minutes,
            "status": "pending",
            "confirmation_status": "pending",
        })

    def confirm_session(self, session_id: str) -> Dict[str, Any]:
        return self.repo.update_session(session_id, {
            "confirmation_status": "confirmed",
            "status": "scheduled",
        })

    def reject_session(self, session_id: str) -> Dict[str, Any]:
        return self.repo.update_session(session_id, {
            "confirmation_status": "rejected",
            "status": "cancelled",
        })

    def complete_session(self, session_id: str) -> Dict[str, Any]:
        return self.repo.update_session(session_id, {"status": "completed"})

    def cancel_session(self, session_id: str) -> Dict[str, Any]:
        return self.repo.update_session(session_id, {
            "status": "cancelled",
            "confirmation_status": "rejected",
        })

    def no_show_session(self, session_id: str) -> Dict[str, Any]:
        return self.repo.update_session(session_id, {"status": "no-show"})

    # ------------------------------------------------------------------
    # Availability
    # ------------------------------------------------------------------

    def get_availability(self, mentor_id: str) -> List[Dict[str, Any]]:
        return self.repo.get_availability(mentor_id)

    def save_availability(
        self, mentor_id: str, rules: List[AvailabilityRuleInput]
    ) -> None:
        self.repo.replace_availability(
            mentor_id,
            [r.model_dump() for r in rules],
        )

    def get_available_slots(
        self, mentor_id: str, date_str: str
    ) -> List[AvailableSlot]:
        target = datetime.fromisoformat(date_str)
        day_of_week = target.weekday()
        # Python: 0=Mon … 6=Sun — JS: 0=Sun … 6=Sat
        js_day = (day_of_week + 1) % 7

        rules = self.repo.get_availability_for_day(mentor_id, js_day)
        if not rules:
            return []

        sessions = self.repo.get_sessions_for_date(mentor_id, date_str)
        booked: set[datetime] = set()
        for s in sessions:
            if s.get("scheduled_at") and s.get("confirmation_status") != "rejected":
                start = datetime.fromisoformat(s["scheduled_at"].replace("Z", "+00:00")).replace(tzinfo=None)
                end = start + timedelta(minutes=s.get("duration_minutes") or SLOT_DURATION_MINUTES)
                cur = start
                while cur < end:
                    booked.add(cur)
                    cur += timedelta(minutes=SLOT_DURATION_MINUTES)

        slots: List[AvailableSlot] = []
        for rule in rules:
            sh, sm = map(int, rule["start_time"].split(":")[:2])
            eh, em = map(int, rule["end_time"].split(":")[:2])
            slot_start = target.replace(hour=sh, minute=sm, second=0, microsecond=0)
            slot_end_bound = target.replace(hour=eh, minute=em, second=0, microsecond=0)
            while slot_start < slot_end_bound:
                slot_end = slot_start + timedelta(minutes=SLOT_DURATION_MINUTES)
                if slot_end <= slot_end_bound and slot_start not in booked:
                    slots.append(AvailableSlot(
                        date=date_str,
                        start_time=slot_start.strftime("%H:%M"),
                        end_time=slot_end.strftime("%H:%M"),
                    ))
                slot_start += timedelta(minutes=SLOT_DURATION_MINUTES)

        return slots

    # ------------------------------------------------------------------
    # Reviews
    # ------------------------------------------------------------------

    def get_reviews(self, mentor_id: str) -> List[Dict[str, Any]]:
        return self.repo.get_reviews(mentor_id)

    def submit_review(
        self,
        mentor_id: str,
        reviewer_id: str,
        rating: float,
        comment: Optional[str],
    ) -> Dict[str, Any]:
        return self.repo.create_review({
            "mentor_id": mentor_id,
            "reviewer_id": reviewer_id,
            "rating": rating,
            "comment": comment,
        })

    # ------------------------------------------------------------------
    # Group chats
    # ------------------------------------------------------------------

    def list_group_chats(self, specialty: Optional[str]) -> List[Dict[str, Any]]:
        return self.repo.get_group_chats(specialty)

    def get_group_chat(self, chat_id: str) -> Optional[Dict[str, Any]]:
        return self.repo.get_group_chat_by_id(chat_id)

    def get_messages(
        self, chat_id: str, limit: int, offset: int
    ) -> List[Dict[str, Any]]:
        return self.repo.get_messages(chat_id, limit, offset)

    def send_message(
        self,
        chat_id: str,
        sender_id: str,
        sender_name: str,
        sender_avatar: Optional[str],
        message: str,
    ) -> Dict[str, Any]:
        return self.repo.send_message({
            "group_chat_id": chat_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "sender_avatar": sender_avatar,
            "message": message,
        })

    def delete_message(self, message_id: str) -> None:
        self.repo.delete_message(message_id)

    def pin_message(self, message_id: str, is_pinned: bool) -> None:
        self.repo.pin_message(message_id, is_pinned)

    def check_membership(self, chat_id: str, user_id: str) -> bool:
        return self.repo.check_membership(chat_id, user_id)

    def get_joined_chat_ids(self, user_id: str) -> List[str]:
        return self.repo.get_joined_chat_ids(user_id)

    def join_chat(self, chat_id: str, user_id: str) -> None:
        self.repo.join_chat(chat_id, user_id)

    def leave_chat(self, chat_id: str, user_id: str) -> None:
        self.repo.leave_chat(chat_id, user_id)
