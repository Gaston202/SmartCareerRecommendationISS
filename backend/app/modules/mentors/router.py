from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.modules.mentors.schemas import (
    AvailableSlot,
    PinMessageRequest,
    SaveAvailabilityRequest,
    ScheduleSessionRequest,
    SendMessageRequest,
    SubmitReviewRequest,
)
from app.modules.mentors.service import MentorService

router = APIRouter(prefix="/mentors", tags=["mentors"])
_svc = MentorService()

# NOTE: Route ordering matters in FastAPI — literal paths must come BEFORE
# parametric paths (e.g. /{mentor_id}) so they are not swallowed as params.

# --------------------------------------------------------------------------
# Mentors — list and by-user (literal prefixes first)
# --------------------------------------------------------------------------

@router.get("")
def list_mentors(
    specialty: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None),
    is_verified: Optional[bool] = Query(None),
) -> List[Dict[str, Any]]:
    return _svc.list_mentors(specialty, min_rating, is_verified)


@router.get("/by-user/{user_id}")
def get_mentor_by_user(user_id: str) -> Dict[str, Any]:
    mentor = _svc.get_mentor_by_user(user_id)
    if not mentor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentor not found")
    return mentor


# --------------------------------------------------------------------------
# Reviews — literal prefix before /{mentor_id}/reviews
# --------------------------------------------------------------------------

@router.post("/reviews", status_code=status.HTTP_201_CREATED)
def submit_review(body: SubmitReviewRequest) -> Dict[str, Any]:
    return _svc.submit_review(
        body.mentor_id, body.reviewer_id, body.rating, body.comment
    )


# --------------------------------------------------------------------------
# Sessions — literal prefixes before /{mentor_id}/sessions
# --------------------------------------------------------------------------

@router.get("/sessions/user")
def get_user_sessions(user_id: str = Query(...)) -> List[Dict[str, Any]]:
    return _svc.get_user_sessions(user_id)


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def schedule_session(body: ScheduleSessionRequest) -> Dict[str, Any]:
    return _svc.schedule_session(
        body.mentor_id,
        body.user_id,
        body.title,
        body.description,
        body.scheduled_at,
        body.duration_minutes,
    )


@router.patch("/sessions/{session_id}/confirm")
def confirm_session(session_id: str) -> Dict[str, Any]:
    return _svc.confirm_session(session_id)


@router.patch("/sessions/{session_id}/reject")
def reject_session(session_id: str) -> Dict[str, Any]:
    return _svc.reject_session(session_id)


@router.patch("/sessions/{session_id}/complete")
def complete_session(session_id: str) -> Dict[str, Any]:
    return _svc.complete_session(session_id)


@router.patch("/sessions/{session_id}/cancel")
def cancel_session(session_id: str) -> Dict[str, Any]:
    return _svc.cancel_session(session_id)


@router.patch("/sessions/{session_id}/no-show")
def no_show_session(session_id: str) -> Dict[str, Any]:
    return _svc.no_show_session(session_id)


# --------------------------------------------------------------------------
# Group chats — all literal /group-chats/* before /{mentor_id}
# --------------------------------------------------------------------------

@router.get("/group-chats/joined")
def get_joined_chats(user_id: str = Query(...)) -> List[str]:
    return _svc.get_joined_chat_ids(user_id)


@router.get("/group-chats")
def list_group_chats(specialty: Optional[str] = Query(None)) -> List[Dict[str, Any]]:
    return _svc.list_group_chats(specialty)


@router.get("/group-chats/{chat_id}/membership")
def check_membership(chat_id: str, user_id: str = Query(...)) -> Dict[str, bool]:
    return {"is_member": _svc.check_membership(chat_id, user_id)}


@router.get("/group-chats/{chat_id}/messages")
def get_messages(
    chat_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    return _svc.get_messages(chat_id, limit, offset)


@router.post("/group-chats/{chat_id}/messages", status_code=status.HTTP_201_CREATED)
def send_message(chat_id: str, body: SendMessageRequest) -> Dict[str, Any]:
    return _svc.send_message(
        chat_id,
        body.sender_id,
        body.sender_name,
        body.sender_avatar,
        body.message,
    )


@router.delete("/group-chats/{chat_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(chat_id: str, message_id: str) -> None:
    _svc.delete_message(message_id)


@router.patch("/group-chats/{chat_id}/messages/{message_id}/pin", status_code=status.HTTP_204_NO_CONTENT)
def pin_message(chat_id: str, message_id: str, body: PinMessageRequest) -> None:
    _svc.pin_message(message_id, body.is_pinned)


@router.post("/group-chats/{chat_id}/join", status_code=status.HTTP_204_NO_CONTENT)
def join_chat(chat_id: str, user_id: str = Query(...)) -> None:
    _svc.join_chat(chat_id, user_id)


@router.delete("/group-chats/{chat_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_chat(chat_id: str, user_id: str = Query(...)) -> None:
    _svc.leave_chat(chat_id, user_id)


@router.get("/group-chats/{chat_id}")
def get_group_chat(chat_id: str) -> Dict[str, Any]:
    chat = _svc.get_group_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group chat not found")
    return chat


# --------------------------------------------------------------------------
# Mentors — parametric /{mentor_id} routes LAST
# --------------------------------------------------------------------------

@router.get("/{mentor_id}/availability/slots")
def get_available_slots(
    mentor_id: str,
    date: str = Query(..., description="ISO date string, e.g. 2026-05-20"),
) -> List[AvailableSlot]:
    return _svc.get_available_slots(mentor_id, date)


@router.get("/{mentor_id}/availability")
def get_availability(mentor_id: str) -> List[Dict[str, Any]]:
    return _svc.get_availability(mentor_id)


@router.put("/{mentor_id}/availability", status_code=status.HTTP_204_NO_CONTENT)
def save_availability(mentor_id: str, body: SaveAvailabilityRequest) -> None:
    _svc.save_availability(mentor_id, body.rules)


@router.get("/{mentor_id}/reviews")
def get_reviews(mentor_id: str) -> List[Dict[str, Any]]:
    return _svc.get_reviews(mentor_id)


@router.get("/{mentor_id}/sessions/pending")
def get_pending_sessions(mentor_id: str) -> List[Dict[str, Any]]:
    return _svc.get_mentor_pending_sessions(mentor_id)


@router.get("/{mentor_id}/sessions")
def get_mentor_sessions(mentor_id: str) -> List[Dict[str, Any]]:
    return _svc.get_mentor_sessions(mentor_id)


@router.get("/{mentor_id}")
def get_mentor(mentor_id: str) -> Dict[str, Any]:
    mentor = _svc.get_mentor(mentor_id)
    if not mentor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentor not found")
    return mentor
