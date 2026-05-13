from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.core.supabase import supabase_service_role as sb


class MentorRepository:

    # ------------------------------------------------------------------
    # Mentors
    # ------------------------------------------------------------------

    def get_all(
        self,
        specialty: Optional[str] = None,
        min_rating: Optional[float] = None,
        is_verified: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        query = (
            sb.from_("mentors")
            .select("*, mentor_specialties(*)")
            .eq("status", "active")
        )
        if min_rating is not None:
            query = query.gte("rating", min_rating)
        if is_verified is not None:
            query = query.eq("is_verified", is_verified)
        result = query.execute()
        rows = result.data or []
        if specialty:
            rows = [
                r for r in rows
                if any(
                    s.get("specialty") == specialty
                    for s in (r.get("mentor_specialties") or [])
                )
            ]
        return rows

    def get_by_id(self, mentor_id: str) -> Optional[Dict[str, Any]]:
        result = (
            sb.from_("mentors")
            .select("*, mentor_specialties(*), mentor_reviews(*)")
            .eq("id", mentor_id)
            .maybe_single()
            .execute()
        )
        return result.data

    def get_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        result = (
            sb.from_("mentors")
            .select("*, mentor_specialties(*), mentor_reviews(*)")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    def get_sessions_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        result = (
            sb.from_("mentor_sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("scheduled_at", desc=False)
            .execute()
        )
        return result.data or []

    def get_sessions_by_mentor(self, mentor_id: str) -> List[Dict[str, Any]]:
        result = (
            sb.from_("mentor_sessions")
            .select("*")
            .eq("mentor_id", mentor_id)
            .order("scheduled_at", desc=False)
            .execute()
        )
        return result.data or []

    def get_pending_sessions_by_mentor(self, mentor_id: str) -> List[Dict[str, Any]]:
        result = (
            sb.from_("mentor_sessions")
            .select("*")
            .eq("mentor_id", mentor_id)
            .eq("confirmation_status", "pending")
            .order("scheduled_at", desc=False)
            .execute()
        )
        return result.data or []

    def create_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        result = (
            sb.from_("mentor_sessions")
            .insert(payload)
            .select()
            .single()
            .execute()
        )
        return result.data

    def update_session(self, session_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        result = (
            sb.from_("mentor_sessions")
            .update(updates)
            .eq("id", session_id)
            .select()
            .single()
            .execute()
        )
        return result.data

    # ------------------------------------------------------------------
    # Availability
    # ------------------------------------------------------------------

    def get_availability(self, mentor_id: str) -> List[Dict[str, Any]]:
        result = (
            sb.from_("mentor_availability_rules")
            .select("*")
            .eq("mentor_id", mentor_id)
            .order("day_of_week", desc=False)
            .order("start_time", desc=False)
            .execute()
        )
        return result.data or []

    def replace_availability(
        self, mentor_id: str, rules: List[Dict[str, Any]]
    ) -> None:
        sb.from_("mentor_availability_rules").delete().eq("mentor_id", mentor_id).execute()
        if rules:
            sb.from_("mentor_availability_rules").insert(
                [{"mentor_id": mentor_id, **r} for r in rules]
            ).execute()

    def get_sessions_for_date(
        self, mentor_id: str, date_str: str
    ) -> List[Dict[str, Any]]:
        day_start = datetime.fromisoformat(date_str).replace(hour=0, minute=0, second=0)
        day_end = day_start.replace(hour=23, minute=59, second=59)
        result = (
            sb.from_("mentor_sessions")
            .select("scheduled_at, duration_minutes, confirmation_status")
            .eq("mentor_id", mentor_id)
            .gte("scheduled_at", day_start.isoformat())
            .lte("scheduled_at", day_end.isoformat())
            .execute()
        )
        return result.data or []

    def get_availability_for_day(
        self, mentor_id: str, day_of_week: int
    ) -> List[Dict[str, Any]]:
        result = (
            sb.from_("mentor_availability_rules")
            .select("*")
            .eq("mentor_id", mentor_id)
            .eq("day_of_week", day_of_week)
            .execute()
        )
        return result.data or []

    # ------------------------------------------------------------------
    # Reviews
    # ------------------------------------------------------------------

    def get_reviews(self, mentor_id: str) -> List[Dict[str, Any]]:
        result = (
            sb.from_("mentor_reviews")
            .select("*")
            .eq("mentor_id", mentor_id)
            .execute()
        )
        return result.data or []

    def create_review(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        result = (
            sb.from_("mentor_reviews")
            .insert(payload)
            .select()
            .single()
            .execute()
        )
        return result.data

    # ------------------------------------------------------------------
    # Group chats
    # ------------------------------------------------------------------

    def get_group_chats(self, specialty: Optional[str] = None) -> List[Dict[str, Any]]:
        query = sb.from_("group_chats").select("*, mentors(*)")
        if specialty:
            query = query.eq("specialty", specialty)
        result = query.execute()
        return result.data or []

    def get_group_chat_by_id(self, chat_id: str) -> Optional[Dict[str, Any]]:
        result = (
            sb.from_("group_chats")
            .select("*, mentors(*)")
            .eq("id", chat_id)
            .maybe_single()
            .execute()
        )
        return result.data

    def get_messages(
        self, chat_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        result = (
            sb.from_("chat_messages")
            .select("*")
            .eq("group_chat_id", chat_id)
            .order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []

    def send_message(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        result = (
            sb.from_("chat_messages")
            .insert(payload)
            .select()
            .single()
            .execute()
        )
        return result.data

    def delete_message(self, message_id: str) -> None:
        sb.from_("chat_messages").delete().eq("id", message_id).execute()

    def pin_message(self, message_id: str, is_pinned: bool) -> None:
        sb.from_("chat_messages").update({"is_pinned": is_pinned}).eq("id", message_id).execute()

    def check_membership(self, chat_id: str, user_id: str) -> bool:
        result = (
            sb.from_("group_chat_members")
            .select("id")
            .eq("group_chat_id", chat_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data is not None

    def get_joined_chat_ids(self, user_id: str) -> List[str]:
        result = (
            sb.from_("group_chat_members")
            .select("group_chat_id")
            .eq("user_id", user_id)
            .execute()
        )
        return [r["group_chat_id"] for r in (result.data or [])]

    def join_chat(self, chat_id: str, user_id: str) -> None:
        # Ignore duplicate key errors (PGRST116)
        try:
            sb.from_("group_chat_members").insert(
                {"group_chat_id": chat_id, "user_id": user_id}
            ).execute()
        except Exception:
            pass

    def leave_chat(self, chat_id: str, user_id: str) -> None:
        sb.from_("group_chat_members").delete().eq("group_chat_id", chat_id).eq("user_id", user_id).execute()
