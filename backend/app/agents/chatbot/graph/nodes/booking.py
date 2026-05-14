"""Multi-step booking subgraph for mentor session scheduling."""
import json
import logging
import re
from typing import Any

from langchain_core.messages import AIMessage

from app.agents.chatbot.graph.nodes.router import _resolve_date, _strip_markdown_fences
from app.agents.chatbot.schemas.pydantic import AvailabilitySlot, BookingContext, Intent
from app.agents.chatbot.tools import get_booking_tool_descriptions_block, get_booking_tool_manifest
from app.core.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)

_TOOL_BLOCK = get_booking_tool_descriptions_block()

BOOKING_CLARIFY_PROMPT = f"""You are a booking assistant for a career mentoring platform. Extract booking details and route to the correct tool based on the user's message.

Available tools for this flow:
{_TOOL_BLOCK}

Booking requirements:
- mentor_id or mentor_name: required
- date: YYYY-MM-DD format, required
- time: HH:MM format, required ONLY for actual booking (not for checking availability)
- duration_minutes: default 30

There are TWO distinct actions:
1. "show_mentors" = checking availability or browsing mentors. For this, ONLY mentor_name and date are needed. Time is NOT required.
2. "ready_to_book" = actually booking a session. For this, mentor_name, date, AND time are ALL required.

Respond with ONLY a valid JSON object:
{{"action": "ask_clarification|show_mentors|ready_to_book",
  "missing": ["mentor", "date", "time"] or [],
  "extracted": {{
    "date": "YYYY-MM-DD or null",
    "time": "HH:MM or null",
    "mentor_name": "string or null",
    "specialty": "string or null"
  }},
  "response": "brief friendly message asking for missing info or confirming what you found"
}}

KEY RULES:
- If user asks to see available mentors, says "any mentor", "list mentors", "show mentors", or "find mentors" → action MUST be "show_mentors".
- If user asks to check a specific mentor's availability or time slots (e.g. "what are the available time slots for mentor X on Friday?") → action MUST be "show_mentors". Do NOT ask for time. Missing time is OK for availability checks.
- If user asks for mentors with a specific specialty (e.g., "mentor with specialty cybersecurity") → action MUST be "show_mentors" and extract the specialty.
- If user asks to BOOK a session and ANY of {{mentor_name, date, time}} is missing → "ask_clarification" with the missing fields.
- If user is checking availability and mentor_name or date is missing → "ask_clarification".
- If all booking fields (mentor, date, time) are present → "ready_to_book".
- Dates: resolve "tomorrow", "today", weekday names to YYYY-MM-DD.
- Keep "response" to 1-2 sentences, be warm and friendly.
Do not include ANY text outside the JSON. Do not use markdown code blocks."""


def _get_last_user_message(state: dict[str, Any]) -> str:
    """Extract the last user message content."""
    messages = state.get("messages", [])
    for msg in reversed(messages):
        if hasattr(msg, "type") and msg.type == "human":
            return msg.content if hasattr(msg, "content") else str(msg)
        if hasattr(msg, "content") and not hasattr(msg, "response_metadata"):
            return str(msg.content)
    return ""


# Keywords for detecting date/time mentions without a mentor name
_BOOKING_DATE_KEYWORDS = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "today", "tomorrow", "next week", "this week",
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "am", "pm", "morning", "afternoon", "evening", "noon", "midnight",
]

# Regex patterns for time detection
_BOOKING_TIME_PATTERNS = [
    r"\d{1,2}:\d{2}",      # HH:MM time pattern
    r"\d{1,2}\s*(am|pm)",  # e.g. "2pm", "3 am"
]

_BOOKING_MENTOR_KEYWORDS = [
    "with", "mentor", "sarah", "james", "emily", "dr.", "prof.", "mr.", "ms.", "mrs.",
]


def _has_date_time_no_mentor(content: str) -> bool:
    """Detect if user provided date/time for booking but no mentor name.

    This lets us skip the second LLM call and ask for the mentor directly.
    """
    content_lower = content.lower()

    # Check for booking action keywords
    has_booking_intent = any(
        kw in content_lower for kw in ["book", "schedule", "session", "appointment", "timeslot", "timeslots", "slot", "slots"]
    )
    if not has_booking_intent:
        return False

    # Check for date/time mentions
    has_date_time = any(kw in content_lower for kw in _BOOKING_DATE_KEYWORDS)
    if not has_date_time:
        # Also check regex patterns for time
        has_date_time = any(re.search(pat, content_lower) for pat in _BOOKING_TIME_PATTERNS)

    if not has_date_time:
        return False

    # Check if a mentor name seems present (heuristic: 'with [Name]' or known names)
    has_mentor = any(kw in content_lower for kw in _BOOKING_MENTOR_KEYWORDS)

    return not has_mentor


def _has_all_booking_details(content: str) -> dict:
    """Check if user provided mentor name, date, AND time in one message.

    Returns a dict with extracted details if all present, empty dict otherwise.
    This lets us skip the second LLM call and book immediately.
    """
    content_lower = content.lower()

    # Check for booking action keywords
    has_booking_intent = any(
        kw in content_lower for kw in ["book", "schedule", "session", "appointment", "timeslot", "timeslots", "slot", "slots"]
    )
    if not has_booking_intent:
        return {}

    # Check for mentor name (after "with")
    mentor_name = None
    if "with" in content_lower:
        # Extract name after "with" - e.g. "with Sarah Chen on Friday"
        mentor_match = re.search(r'with\s+([A-Z][a-zA-Z\s\.]+?)(?:\s+on\s+|\s+at\s+|\s+for\s+|\s+this\s+|\s+next\s+|$)', content, re.IGNORECASE)
        if mentor_match:
            mentor_name = mentor_match.group(1).strip()

    # Check for date
    date = None
    day_words = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow"]
    for day in day_words:
        if day in content_lower:
            date = _resolve_date(day)
            break
    if not date:
        # Try regex for YYYY-MM-DD
        date_match = re.search(r'\d{4}-\d{2}-\d{2}', content)
        if date_match:
            date = date_match.group(0)

    # Check for time (HH:MM or H:MM or H am/pm)
    time = None
    # Try HH:MM format first
    time_match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)?', content, re.IGNORECASE)
    if time_match:
        hour = int(time_match.group(1))
        minute = time_match.group(2)
        ampm = time_match.group(3)
        if ampm:
            if ampm.lower() == 'pm' and hour != 12:
                hour += 12
            elif ampm.lower() == 'am' and hour == 12:
                hour = 0
        time = f"{hour:02d}:{minute}"
    else:
        # Try H am/pm format (no colon) - e.g. "2pm", "3 am"
        time_match = re.search(r'(\d{1,2})\s*(am|pm)', content, re.IGNORECASE)
        if time_match:
            hour = int(time_match.group(1))
            ampm = time_match.group(2)
            if ampm.lower() == 'pm' and hour != 12:
                hour += 12
            elif ampm.lower() == 'am' and hour == 12:
                hour = 0
            time = f"{hour:02d}:00"

    if mentor_name and date and time:
        return {
            "mentor_name": mentor_name,
            "date": date,
            "time": time,
        }
    return {}


def _has_mentor_and_date(content: str) -> dict:
    """Check if user asked to check availability with a mentor on a date (no time needed).

    Returns a dict with mentor_name and date if both are present, empty dict otherwise.
    This lets us skip the LLM call for availability queries like
    'what are the available timeslots with Sarah Chen on Friday?'.
    """
    content_lower = content.lower()

    # Check for availability-related keywords
    has_availability_intent = any(
        kw in content_lower for kw in [
            "timeslot", "timeslots", "slot", "slots", "available",
            "availability", "when is", "when are", "free", "open",
        ]
    )
    if not has_availability_intent:
        return {}

    # Check for mentor name (after "with")
    mentor_name = None
    if "with" in content_lower:
        mentor_match = re.search(
            r'with\s+([A-Z][a-zA-Z\s\.]+?)(?:\s+on\s+|\s+at\s+|\s+for\s+|\s+this\s+|\s+next\s+|$)',
            content, re.IGNORECASE,
        )
        if mentor_match:
            mentor_name = mentor_match.group(1).strip()

    if not mentor_name:
        # Try "mentor [Name]" pattern
        mentor_match = re.search(
            r'(?:mentor|advisor|coach)\s+([A-Z][a-zA-Z\s\.]+?)(?:\s+on\s+|\s+at\s+|\s+for\s+|\s+this\s+|\s+next\s+|$)',
            content, re.IGNORECASE,
        )
        if mentor_match:
            mentor_name = mentor_match.group(1).strip()

    # Check for date
    date = None
    day_words = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow"]
    for day in day_words:
        if day in content_lower:
            date = _resolve_date(day)
            break
    if not date:
        date_match = re.search(r'\d{4}-\d{2}-\d{2}', content)
        if date_match:
            date = date_match.group(0)

    if mentor_name and date:
        return {"mentor_name": mentor_name, "date": date}
    return {}


def _classify_error(error: Exception) -> str:
    """Map exception types to user-friendly messages."""
    cls_name = type(error).__name__.lower()
    msg = str(error).lower()

    if "timeout" in msg or "timed out" in msg:
        return "The booking service is taking too long to respond"
    if "json" in cls_name or "jsondecode" in msg or "decode" in msg:
        return "I had trouble processing the booking details"
    if "connection" in msg or "network" in msg or "refused" in msg:
        return "I couldn't reach the booking service"
    if "key" in cls_name or "attribute" in cls_name or "type" in cls_name:
        return "Some booking information was missing or invalid"
    if "supabase" in msg or "database" in msg:
        return "I couldn't access the booking database"
    return str(error)[:100]


def _validate_booking_output(parsed: dict) -> tuple[bool, str]:
    """Validate booking LLM output has required fields."""
    action = parsed.get("action")
    valid_actions = {"ask_clarification", "show_mentors", "ready_to_book"}
    if action not in valid_actions:
        return False, f"Invalid action: {action}"

    if "response" not in parsed:
        return False, "Missing 'response' field"

    if action == "ask_clarification" and "missing" not in parsed:
        return False, "Missing 'missing' field for ask_clarification"

    return True, ""


async def booking_clarify_node(state: dict[str, Any], orchestrator: AIOrchestrator | None = None) -> dict[str, Any]:
    """Phase 1: Extract booking entities and decide next step.

    Routes based on action:
    - ask_clarification → return question to user (END)
    - show_mentors → proceed to booking_availability_node
    - ready_to_book → proceed to booking_execute_node

    Optimization: If the router already detected a tool call (e.g., get_available_mentors),
    skip the LLM call and route directly to save time and avoid timeouts.
    """
    user_message = _get_last_user_message(state)
    booking_data = state.get("booking_data") or BookingContext()
    booking_data.attempts = (booking_data.attempts or 0) + 1
    is_compound = state.get("compound_greeting", False)

    # ── Fast path #1: user provided ALL booking details (mentor + date + time) ──
    # This takes priority over router tool detection so we can book immediately.
    complete_details = _has_all_booking_details(user_message)
    if complete_details:
        logger.info(
            "booking_clarify: fast path → ready_to_book (mentor=%s date=%s time=%s)",
            complete_details["mentor_name"],
            complete_details["date"],
            complete_details["time"],
        )
        booking_data.mentor_name = complete_details["mentor_name"]
        booking_data.preferred_date = complete_details["date"]
        booking_data.preferred_time = complete_details["time"]
        return {
            "messages": [AIMessage(content=f"I'll book your session with {complete_details['mentor_name']} on {complete_details['date']} at {complete_details['time']}.")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "ready_to_book",
            "last_tool_used": "ready_to_book",
            "compound_greeting": False,
        }

    # ── Fast path #1.5: user asked for availability with a specific mentor on a date ──
    availability_query = _has_mentor_and_date(user_message)
    if availability_query:
        logger.info(
            "booking_clarify: fast path → show_mentors (availability mentor=%s date=%s)",
            availability_query["mentor_name"],
            availability_query["date"],
        )
        booking_data.mentor_name = availability_query["mentor_name"]
        booking_data.preferred_date = availability_query["date"]
        # Resolve mentor name to ID immediately
        resolved = await find_mentor_by_name.ainvoke({"name": availability_query["mentor_name"]})
        if resolved.get("found"):
            mentor = resolved["mentor"]
            booking_data.mentor_id = mentor.get("id")
            booking_data.mentor_name = mentor.get("name", booking_data.mentor_name)
        return {
            "messages": [AIMessage(content=f"Let me check {booking_data.mentor_name}'s availability for {booking_data.preferred_date}.")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "show_mentors",
            "last_tool_used": "show_mentors",
            "compound_greeting": False,
        }

    # ── Fast path #2: router already told us which tool to use ──────────
    last_tool = state.get("last_tool_used")
    if last_tool in ("get_available_mentors", "check_mentor_availability", "find_mentor_by_name"):
        logger.info("booking_clarify: fast path → show_mentors (last_tool=%s)", last_tool)
        return {
            "messages": [AIMessage(content="Let me get the mentors list for you.")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "show_mentors",
            "last_tool_used": "show_mentors",
            "compound_greeting": False,
        }
    if last_tool == "book_mentor_session":
        logger.info("booking_clarify: fast path → ready_to_book")
        return {
            "messages": [AIMessage(content="I'll help you book that session.")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "ready_to_book",
            "last_tool_used": "ready_to_book",
            "compound_greeting": False,
        }

    # ── Fast path #3: user mentioned booking with date/time but no mentor ──────────
    if _has_date_time_no_mentor(user_message):
        logger.info("booking_clarify: fast path → ask_clarification (date/time but no mentor)")
        return {
            "messages": [AIMessage(content="Great! I have the date and time. Which mentor would you like to book with?")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "clarification",
            "last_tool_used": "ask_clarification",
            "compound_greeting": False,
        }

    if orchestrator is None:
        return {
            "messages": [AIMessage(content="I'd be happy to help you book a mentor session. What date and time works for you?")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "clarification",
            "last_tool_used": "ask_clarification",
        }

    try:
        context_info = ""
        if booking_data.mentor_name:
            context_info += f"Current mentor: {booking_data.mentor_name}\n"
        if booking_data.preferred_date:
            context_info += f"Current date: {booking_data.preferred_date}\n"
        if booking_data.preferred_time:
            context_info += f"Current time: {booking_data.preferred_time}\n"

        system_content = BOOKING_CLARIFY_PROMPT
        if context_info:
            system_content += f"\n\nAlready known:\n{context_info}"

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_message},
        ]

        response = await orchestrator.chat_with_retry(
            task="chatbot",
            messages=messages,
            temperature=0.4,
            max_tokens=500,
            retries=2,
            response_format={"type": "json_object"},
            tools=get_booking_tool_manifest(),
        )

        message = response.get("choices", [{}])[0].get("message", {})
        content = message.get("content", "")

        # Check for native tool calls from the LLM
        tool_calls = message.get("tool_calls", [])
        if tool_calls:
            first_tool = tool_calls[0]
            tool_name = first_tool.get("function", {}).get("name", "")
            logger.info("booking_clarify: detected tool_call=%s", tool_name)

            if tool_name == "get_available_mentors":
                return {
                    "messages": [AIMessage(content="Here are our available mentors:")],
                    "booking_data": booking_data,
                    "current_intent": Intent.BOOKING,
                    "booking_stage": "show_mentors",
                    "last_tool_used": "show_mentors",
                    "compound_greeting": False,
                }
            elif tool_name == "check_mentor_availability":
                return {
                    "messages": [AIMessage(content="Let me check that mentor's availability.")],
                    "booking_data": booking_data,
                    "current_intent": Intent.BOOKING,
                    "booking_stage": "show_mentors",
                    "last_tool_used": "show_mentors",
                    "compound_greeting": False,
                }
            elif tool_name == "book_mentor_session":
                return {
                    "messages": [AIMessage(content="I'll help you book that session.")],
                    "booking_data": booking_data,
                    "current_intent": Intent.BOOKING,
                    "booking_stage": "ready_to_book",
                    "last_tool_used": "ready_to_book",
                    "compound_greeting": False,
                }

        if not content:
            return _booking_clarify_fallback(booking_data, is_compound)

        content = _strip_markdown_fences(content)

        parsed = json.loads(content)
        valid, error_msg = _validate_booking_output(parsed)
        if not valid:
            logger.warning(f"booking_clarify: invalid output: {error_msg}, retrying with simplified prompt")
            parsed = await _retry_clarify_simplified(orchestrator, user_message, context_info)
            if parsed is None:
                return _booking_clarify_fallback(booking_data, is_compound)

        action = parsed.get("action", "ask_clarification")
        response_text = parsed.get("response", "How can I help with your booking?")
        extracted = parsed.get("extracted", {})

        if extracted.get("date"):
            booking_data.preferred_date = _resolve_date(extracted["date"]) or extracted["date"]
        if extracted.get("time"):
            booking_data.preferred_time = extracted["time"]
        if extracted.get("mentor_name"):
            booking_data.mentor_name = extracted["mentor_name"]
            # Resolve mentor name to ID immediately
            from app.agents.chatbot.tools.booking import find_mentor_by_name
            resolved = await find_mentor_by_name.ainvoke({"name": extracted["mentor_name"]})
            if resolved.get("found"):
                mentor = resolved["mentor"]
                booking_data.mentor_id = mentor.get("id")
                booking_data.mentor_name = mentor.get("name", booking_data.mentor_name)
        if extracted.get("specialty"):
            booking_data.specialty = extracted["specialty"]
        elif not booking_data.specialty:
            # Fallback: extract specialty from user message using simple regex
            spec_match = re.search(
                r"(?:specialty|specializ(?:ation|ed in)|field|area|expertise)\s*(?:of|:|in)?\s*([A-Za-z0-9\s\-+#.]+)",
                user_message,
                re.IGNORECASE,
            )
            if spec_match:
                booking_data.specialty = spec_match.group(1).strip().rstrip(".?!")

        if is_compound and not response_text.lower().startswith(("hello", "hi ", "hey", "greetings", "good ")):
            response_text = f"Hello! {response_text}"

        booking_data.stage = action

        logger.info(f"booking_clarify: action={action}, missing={parsed.get('missing', [])}")

        return {
            "messages": [AIMessage(content=response_text)],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": action,
            "last_tool_used": action,
            "compound_greeting": False,
        }

    except json.JSONDecodeError as e:
        logger.error(f"booking_clarify JSON error: {e}")
        return _booking_clarify_fallback(booking_data, is_compound)
    except Exception as e:
        logger.error(f"booking_clarify error: {type(e).__name__}: {e}", exc_info=True)
        error_detail = _classify_error(e)
        response_text = f"I ran into a small issue: {error_detail}. Let me help you differently. What date and time would you like for your session?"
        if is_compound:
            response_text = f"Hello! {response_text}"
        return {
            "messages": [AIMessage(content=response_text)],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "clarification",
            "last_tool_used": "ask_clarification",
            "error_message": f"{type(e).__name__}: {str(e)[:200]}",
        }


def _booking_clarify_fallback(booking_data: BookingContext, is_compound: bool) -> dict[str, Any]:
    """Fallback response when booking clarify fails."""
    text = "I'd be happy to help you book a mentor session! What date and time works best for you?"
    if is_compound:
        text = f"Hello! {text}"
    return {
        "messages": [AIMessage(content=text)],
        "booking_data": booking_data,
        "current_intent": Intent.BOOKING,
        "booking_stage": "clarification",
        "last_tool_used": "ask_clarification",
    }


async def _retry_clarify_simplified(orchestrator: AIOrchestrator, user_message: str, context_info: str) -> dict | None:
    """Retry with a simplified, more explicit prompt."""
    simple_prompt = f"""Extract booking info from this message: "{user_message}"

You MUST output EXACTLY this JSON structure with no extra text:
{{"action":"show_mentors","missing":[],"extracted":{{"date":null,"time":null,"mentor_name":null,"specialty":null}},"response":"your reply"}}

If the user asks to check availability or see available mentors → "show_mentors" (time is NOT required)
If the user wants to BOOK and important details are missing → "ask_clarification" with missing=["mentor"] or ["date"] or ["time"]
If all booking details (mentor, date, time) are present → "ready_to_book"

{context_info}"""
    try:
        response = await orchestrator.chat_with_retry(
            task="chatbot",
            messages=[
                {"role": "system", "content": simple_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
            max_tokens=400,
            retries=1,
            response_format={"type": "json_object"},
            tools=get_booking_tool_manifest(),
        )
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        if content:
            content = _strip_markdown_fences(content)
            return json.loads(content)
    except Exception:
        pass
    return None


async def booking_availability_node(state: dict[str, Any]) -> dict[str, Any]:
    """Phase 2: Query Supabase for real mentor availability. Zero LLM calls.

    - If mentor_id + date known: check that mentor's slots
    - If only date known or user wants to browse: list all available mentors
    """
    booking_data = state.get("booking_data") or BookingContext()

    try:
        from app.agents.chatbot.tools.booking import (
            check_mentor_availability,
            find_mentor_by_name,
            get_available_mentors,
        )

        # Defensive: if mentor_name is missing but the original message mentions one, extract it
        if not booking_data.mentor_name and not booking_data.mentor_id:
            user_message = _get_last_user_message(state)
            if user_message:
                avail_info = _has_mentor_and_date(user_message)
                if avail_info.get("mentor_name"):
                    booking_data.mentor_name = avail_info["mentor_name"]
                # Also recover date if missing
                if avail_info.get("date") and not booking_data.preferred_date:
                    booking_data.preferred_date = avail_info["date"]

        # Resolve mentor name to ID if missing
        if not booking_data.mentor_id and booking_data.mentor_name:
            resolved = await find_mentor_by_name.ainvoke({"name": booking_data.mentor_name})
            if resolved.get("found"):
                mentor = resolved["mentor"]
                booking_data.mentor_id = mentor.get("id")
                booking_data.mentor_name = mentor.get("name", booking_data.mentor_name)

        response_text = ""

        if booking_data.mentor_id and booking_data.preferred_date:
            result = await check_mentor_availability.ainvoke({
                "mentor_id": booking_data.mentor_id,
                "date": booking_data.preferred_date,
                "duration_minutes": booking_data.duration_minutes,
            })
            slots = result.get("slots", [])
            available = [s for s in slots if s.get("is_available")]

            if available:
                response_text = f"Here are available slots for {booking_data.mentor_name or 'this mentor'} on {booking_data.preferred_date}:\n\n"
                for s in available[:6]:
                    response_text += f"- {s['start_time']} to {s['end_time']}\n"
                response_text += "\nWhich time would you prefer?"
            else:
                response_text = f"No slots available for {booking_data.mentor_name or 'that mentor'} on {booking_data.preferred_date}. Would you like to try a different date or see all available mentors?"

            booking_data.slots = [
                AvailabilitySlot(
                    mentor_id=booking_data.mentor_id or "",
                    mentor_name=booking_data.mentor_name or "Mentor",
                    start_time=s['start_time'],
                    end_time=s['end_time'],
                    is_available=s.get('is_available', True),
                )
                for s in available
            ]

        else:
            date_to_check = booking_data.preferred_date
            result = await get_available_mentors.ainvoke({
                "date": date_to_check,
                "specialty": booking_data.specialty,
                "limit": 5,
            })
            mentors = result.get("mentors", [])

            if mentors:
                if date_to_check:
                    response_text = f"Here are mentors available on {date_to_check}:\n\n"
                else:
                    response_text = "Here are our available mentors:\n\n"
                for m in mentors[:5]:
                    specialties = ", ".join(m.get("specialties", [])[:3])
                    response_text += f"- **{m.get('name', 'Mentor')}**"
                    if m.get("role"):
                        response_text += f" ({m['role']})"
                    if specialties:
                        response_text += f" — {specialties}"
                    if m.get("rating"):
                        response_text += f" — {m['rating']}/5"
                    response_text += "\n"
                response_text += "\nWhich mentor would you like to book with, and on what date?"
            else:
                response_text = "I couldn't find any available mentors right now. Please try a different date or check back later."

        booking_data.stage = "selecting_slot"

        return {
            "messages": [AIMessage(content=response_text)],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "selecting_slot",
            "last_tool_used": "check_availability",
        }

    except Exception as e:
        logger.error(f"booking_availability error: {type(e).__name__}: {e}", exc_info=True)
        error_detail = _classify_error(e)
        return {
            "messages": [AIMessage(content=f"I had trouble checking availability: {error_detail}. Could you try again or specify a date and mentor name?")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "selecting_slot",
            "last_tool_used": "check_availability",
            "error_message": f"{type(e).__name__}: {str(e)[:200]}",
        }


async def booking_execute_node(state: dict[str, Any]) -> dict[str, Any]:
    """Phase 3: Execute the booking. Validates fields, calls book_mentor_session.

    Returns success with session_id or error prompting retry.
    """
    booking_data = state.get("booking_data") or BookingContext()
    user_id = state.get("user_id", "unknown")

    try:
        from app.agents.chatbot.tools.booking import book_mentor_session, find_mentor_by_name

        # Resolve mentor name to ID if needed
        if not booking_data.mentor_id and booking_data.mentor_name:
            resolved = await find_mentor_by_name.ainvoke({"name": booking_data.mentor_name})
            if resolved.get("found"):
                mentor = resolved["mentor"]
                booking_data.mentor_id = mentor.get("id")
                booking_data.mentor_name = mentor.get("name", booking_data.mentor_name)

        if not booking_data.mentor_id:
            return {
                "messages": [AIMessage(content="I need to know which mentor you'd like to book. Could you tell me their name?")],
                "booking_data": booking_data,
                "current_intent": Intent.BOOKING,
                "booking_stage": "failed",
                "last_tool_used": "book_session",
            }

        if not booking_data.preferred_date:
            return {
                "messages": [AIMessage(content="I need to know which date you'd like to book. Do you have a date in mind?")],
                "booking_data": booking_data,
                "current_intent": Intent.BOOKING,
                "booking_stage": "failed",
                "last_tool_used": "book_session",
            }

        if not booking_data.preferred_time:
            return {
                "messages": [AIMessage(content="I need to know what time works for you. What time would you prefer?")],
                "booking_data": booking_data,
                "current_intent": Intent.BOOKING,
                "booking_stage": "failed",
                "last_tool_used": "book_session",
            }

        mentor_name = booking_data.mentor_name or "your mentor"
        result = await book_mentor_session.ainvoke({
            "mentor_id": booking_data.mentor_id,
            "user_id": user_id,
            "date": booking_data.preferred_date,
            "time": booking_data.preferred_time,
            "title": f"Mentor Session with {mentor_name}",
            "duration_minutes": booking_data.duration_minutes,
        })

        if result.get("success"):
            booking_data.confirmed = True
            booking_data.stage = "completed"
            booking_data.session_id = result.get("session_id", "")
            response_text = (
                f"Your session with {mentor_name} is confirmed!\n\n"
                f"Date: {booking_data.preferred_date}\n"
                f"Time: {booking_data.preferred_time}\n"
                f"Duration: {booking_data.duration_minutes} minutes\n"
                f"Session ID: {booking_data.session_id}\n\n"
                f"Is there anything else I can help with?"
            )
            return {
                "messages": [AIMessage(content=response_text)],
                "booking_data": booking_data,
                "current_intent": Intent.BOOKING,
                "booking_stage": "completed",
                "confirmed": True,
                "last_tool_used": "book_session",
            }
        else:
            error_msg = result.get("message", "Unknown error")
            return {
                "messages": [AIMessage(content=f"I couldn't complete the booking: {error_msg}. Would you like to try a different date or time?")],
                "booking_data": booking_data,
                "current_intent": Intent.BOOKING,
                "booking_stage": "failed",
                "last_tool_used": "book_session",
                "error_message": error_msg,
            }

    except Exception as e:
        logger.error(f"booking_execute error: {type(e).__name__}: {e}", exc_info=True)
        error_detail = _classify_error(e)
        return {
            "messages": [AIMessage(content=f"I couldn't complete the booking: {error_detail}. Please try again with the mentor name, date, and time.")],
            "booking_data": booking_data,
            "current_intent": Intent.BOOKING,
            "booking_stage": "failed",
            "last_tool_used": "book_session",
            "error_message": f"{type(e).__name__}: {str(e)[:200]}",
        }


def booking_response_node(state: dict[str, Any]) -> dict[str, Any]:
    """Phase 4: Clean up and ensure natural response formatting.

    Used after availability and execute nodes to ensure the response
    is polished. Currently the nodes handle their own formatting,
    so this acts as a pass-through with stage normalization.
    """
    booking_data = state.get("booking_data") or BookingContext()

    booking_data.attempts = 0

    return {
        "booking_data": booking_data,
        "conversation_summary": f"Booking flow stage: {booking_data.stage}",
    }


# Legacy aliases for backward compatibility
llm_booking_node = booking_clarify_node
check_availability_node = booking_clarify_node
show_options_node = booking_clarify_node
confirm_booking_node = booking_execute_node
execute_booking_node = booking_execute_node
