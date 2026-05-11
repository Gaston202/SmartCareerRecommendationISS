from datetime import datetime, timedelta
from typing import Optional
from langchain_core.tools import tool
from supabase import AsyncClient

from app.agents.chatbot.schemas.pydantic import (
    AvailabilitySlot,
    BookingRequest,
    BookingResponse,
)


async def get_supabase_client() -> AsyncClient:
    """Get Supabase client for database operations."""
    from app.core.database import DatabaseService
    db_service = await DatabaseService.create()
    return db_service.get_client()


@tool
async def check_mentor_availability(
    mentor_id: str,
    date: str,
    duration_minutes: int = 30
) -> dict:
    """
    Check a specific mentor's availability on a given date.
    Returns available time slots for the mentor.

    Args:
        mentor_id: UUID of the mentor
        date: Date in YYYY-MM-DD format
        duration_minutes: Desired session duration (default 30)

    Returns:
        Dictionary with availability slots or error message
    """
    client = await get_supabase_client()

    day_start = f"{date}T00:00:00"
    day_end = f"{date}T23:59:59"

    response = await client.from_("mentor_sessions").select("*").eq(
        "mentor_id", mentor_id
    ).eq("status", "scheduled").gte(
        "scheduled_at", day_start
    ).lte("scheduled_at", day_end).execute()

    booked_slots = response.data or []

    work_start_hour = 9
    work_end_hour = 18

    available_slots = []
    current_slot = datetime.strptime(f"{date} 09:00", "%Y-%m-%d %H:%M")

    while current_slot.hour < work_end_hour:
        slot_end = current_slot + timedelta(minutes=duration_minutes)

        if slot_end.hour > work_end_hour:
            break

        is_booked = any(
            (datetime.strptime(session["scheduled_at"], "%Y-%m-%dT%H:%M:%S") <= current_slot <
             datetime.strptime(session["scheduled_at"], "%Y-%m-%dT%H:%M:%S") + timedelta(minutes=session.get("duration_minutes", 30)))
            for session in booked_slots
        )

        available_slots.append({
            "start_time": current_slot.strftime("%H:%M"),
            "end_time": slot_end.strftime("%H:%M"),
            "is_available": not is_booked
        })

        current_slot += timedelta(minutes=30)

    mentor_response = await client.from_("mentors").select("name").eq("id", mentor_id).execute()
    mentor_name = mentor_response.data[0]["name"] if mentor_response.data else "Unknown Mentor"

    return {
        "mentor_id": mentor_id,
        "mentor_name": mentor_name,
        "date": date,
        "slots": available_slots,
        "available_count": sum(1 for s in available_slots if s["is_available"])
    }


@tool
async def get_available_mentors(
    date: Optional[str] = None,
    specialty: Optional[str] = None,
    limit: int = 10
) -> dict:
    """
    Get list of available mentors, optionally filtered by date and specialty.

    Args:
        date: Optional date in YYYY-MM-DD format to check availability
        specialty: Optional specialty area (e.g., 'web development', 'data science')
        limit: Maximum number of mentors to return (default 10)

    Returns:
        Dictionary with list of mentors and their availability
    """
    client = await get_supabase_client()

    query = client.from_("mentors").select("*, mentor_specialties(specialty)").eq(
        "status", "active"
    ).limit(limit)

    if specialty:
        query = query.contains("mentor_specialties", [{"specialty": specialty}])

    response = await query.execute()
    mentors = response.data or []

    result = []
    for mentor in mentors:
        mentor_info = {
            "id": mentor["id"],
            "name": mentor["name"],
            "email": mentor["email"],
            "company": mentor.get("company"),
            "role": mentor.get("role"),
            "rating": mentor.get("rating", 0),
            "total_reviews": mentor.get("total_reviews", 0),
            "specialties": [s["specialty"] for s in mentor.get("mentor_specialties", [])],
            "is_verified": mentor.get("is_verified", False)
        }

        if date:
            day_start = f"{date}T00:00:00"
            day_end = f"{date}T23:59:59"

            avail_response = await client.from_("mentor_sessions").select("*").eq(
                "mentor_id", mentor["id"]
            ).eq("status", "scheduled").gte(
                "scheduled_at", day_start
            ).lte("scheduled_at", day_end).execute()

            total_slots = 18  # 9am-6pm in 30-min increments = 18 slots
            booked_count = len(avail_response.data) if avail_response.data else 0
            mentor_info["available_on_date"] = booked_count < total_slots
            mentor_info["slots_taken"] = booked_count
            mentor_info["slots_available"] = total_slots - booked_count

        result.append(mentor_info)

    return {
        "mentors": result,
        "count": len(result),
        "filters": {"date": date, "specialty": specialty}
    }


@tool
async def find_mentor_by_name(name: str) -> dict:
    """
    Find a mentor by name using fuzzy/ILIKE matching.

    Args:
        name: Partial or full mentor name

    Returns:
        Dictionary with mentor info or None if not found
    """
    client = await get_supabase_client()
    search = name.strip()
    if not search:
        return {"found": False, "mentor": None}

    # Try exact match first
    response = await client.from_("mentors").select("id, name, email, role, rating, status").eq("status", "active").ilike("name", search).limit(1).execute()
    if response.data:
        return {"found": True, "mentor": response.data[0]}

    # Try contains match
    response = await client.from_("mentors").select("id, name, email, role, rating, status").eq("status", "active").ilike("name", f"%{search}%").limit(1).execute()
    if response.data:
        return {"found": True, "mentor": response.data[0]}

    # Try word-by-word matching for multi-word names
    parts = [p for p in search.split() if len(p) > 2]
    for part in parts:
        response = await client.from_("mentors").select("id, name, email, role, rating, status").eq("status", "active").ilike("name", f"%{part}%").limit(1).execute()
        if response.data:
            return {"found": True, "mentor": response.data[0]}

    return {"found": False, "mentor": None}


@tool
async def book_mentor_session(booking: dict) -> dict:
    """
    Book a mentor session in the database.

    Args:
        booking: Dictionary containing:
            - mentor_id: UUID of the mentor
            - user_id: UUID of the user
            - date: Date in YYYY-MM-DD format
            - time: Time in HH:MM format (24-hour)
            - title: Session title (optional)
            - description: Session description (optional)
            - duration_minutes: Session duration (optional, default 30)

    Returns:
        Dictionary with booking confirmation or error
    """
    client = await get_supabase_client()

    try:
        scheduled_datetime = f"{booking['date']}T{booking['time']}:00"

        data = {
            "mentor_id": booking["mentor_id"],
            "user_id": booking["user_id"],
            "title": booking.get("title", "Mentor Session"),
            "description": booking.get("description"),
            "scheduled_at": scheduled_datetime,
            "duration_minutes": booking.get("duration_minutes", 30),
            "status": "scheduled"
        }

        response = await client.from_("mentor_sessions").insert(data).execute()

        if response.data:
            session = response.data[0]
            return {
                "success": True,
                "session_id": session["id"],
                "message": f"Session booked successfully with {booking.get('mentor_name', 'mentor')}",
                "scheduled_at": scheduled_datetime,
                "mentor_id": booking["mentor_id"],
                "user_id": booking["user_id"]
            }
        else:
            return {"success": False, "message": "Failed to create session record"}

    except Exception as e:
        return {"success": False, "message": str(e)}


@tool
async def get_user_sessions(user_id: str, status: str = "scheduled") -> dict:
    """
    Get a user's mentor sessions.

    Args:
        user_id: UUID of the user
        status: Session status filter (scheduled, completed, cancelled)

    Returns:
        Dictionary with user's sessions
    """
    client = await get_supabase_client()

    response = await client.from_("mentor_sessions").select(
        "*, mentors(name, avatar, company, role)"
    ).eq("user_id", user_id).eq("status", status).order(
        "scheduled_at", desc=False
    ).execute()

    sessions = response.data or []

    return {
        "sessions": [
            {
                "id": s["id"],
                "title": s["title"],
                "description": s.get("description"),
                "scheduled_at": s["scheduled_at"],
                "duration_minutes": s.get("duration_minutes", 30),
                "status": s["status"],
                "meeting_link": s.get("meeting_link"),
                "mentor": s.get("mentors", {})
            }
            for s in sessions
        ],
        "count": len(sessions),
        "user_id": user_id,
        "status_filter": status
    }


@tool
async def get_mentor_details(mentor_id: str) -> dict:
    """
    Get detailed information about a specific mentor.

    Args:
        mentor_id: UUID of the mentor

    Returns:
        Dictionary with mentor details
    """
    client = await get_supabase_client()

    response = await client.from_("mentors").select(
        "*, mentor_specialties(specialty, is_primary)"
    ).eq("id", mentor_id).execute()

    if not response.data:
        return {"success": False, "message": "Mentor not found"}

    mentor = response.data[0]

    return {
        "success": True,
        "mentor": {
            "id": mentor["id"],
            "name": mentor["name"],
            "email": mentor["email"],
            "bio": mentor.get("bio"),
            "avatar": mentor.get("avatar"),
            "company": mentor.get("company"),
            "role": mentor.get("role"),
            "years_of_experience": mentor.get("years_of_experience", 0),
            "rating": mentor.get("rating", 0),
            "total_reviews": mentor.get("total_reviews", 0),
            "is_verified": mentor.get("is_verified", False),
            "status": mentor.get("status"),
            "specialties": [
                {"specialty": s["specialty"], "is_primary": s["is_primary"]}
                for s in mentor.get("mentor_specialties", [])
            ]
        }
    }
