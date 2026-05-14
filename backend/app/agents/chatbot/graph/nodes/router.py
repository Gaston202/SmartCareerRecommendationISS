"""LLM-based intent routing and entity extraction for the chatbot."""
import logging
import json
import re
from typing import Dict, Any, Optional
from langchain_core.messages import HumanMessage

from app.agents.chatbot.schemas.pydantic import Intent, BookingContext, RouteDecision
from app.agents.chatbot.tools import get_tool_descriptions_block, get_tool_manifest
from app.core.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)


# ── Markdown/JSON cleaning helpers ─────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    """Strip markdown ```json ... ``` wrappers from LLM output."""
    if not text:
        return text
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


ROUTER_SYSTEM_PROMPT_TEMPLATE = """You are an intent classifier and entity extractor for a career assistant chatbot.

You have access to the following tools to help users:

{tool_block}

Analyze the user's latest message and classify it into EXACTLY one of these intents:
- **greeting**: Pure greetings, hellos, hi, hey, good morning/afternoon/evening with no action request
- **general**: Casual chat, small talk, asking what the bot can do, help request, or general questions
- **booking**: User wants to schedule, book, or manage a mentor session. Also includes browsing or listing available mentors. Examples: "list available mentors", "show mentors", "find a mentor", "book a session".
- **search**: User asks about careers, jobs, salaries, trends, skills, market data. Examples: "what jobs are in demand?", "salary for data scientist".
- **user_sessions**: User asks about their own upcoming or past mentor sessions. Examples: "show my sessions", "when is my next meeting?".
- **explain_feature**: User asks about app features (quiz, mentors, roadmap, careers, CV analysis). Examples: "how does the quiz work?", "explain the roadmap feature".
- **career_info**: User asks about a specific career path (e.g., "Tell me about data science").
- **profile**: User asks about their own profile, skills, career matches, or personalized recommendations. Examples: "what careers match my profile?", "show my skills", "what should I learn next?", "my career matches", "tell me about my profile".
- **help**: Help requests. Examples: "What can you do?", "Show me features".
- **fallback**: Unclear or off-topic request

Respond ONLY with a valid JSON object in this exact schema:
{{
  "intent": "greeting|general|booking|search|user_sessions|explain_feature|career_info|profile|help|fallback",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of your classification",
  "entities": {{
    "date": "YYYY-MM-DD or null",
    "time": "HH:MM or null",
    "mentor_name": "string or null",
    "specialty": "string or null",
    "feature": "quiz|mentors|roadmap|careers|cv or null",
    "career_name": "string or null",
    "search_query": "string or null"
  }}
}}

Guidelines:
- When the user asks to list, show, browse, or find mentors → intent MUST be "booking". The booking flow will handle using the get_available_mentors tool.
- When the user asks for mentors with a specific specialty (e.g., "mentor with specialty cybersecurity") → intent MUST be "booking" and extract the specialty.
- When the user asks to check a mentor's availability or time slots (e.g., "what are the available time slots for mentor X on Friday?") → intent MUST be "booking", extract the mentor_name and date.
- When the user asks about THEIR OWN profile, skills, career matches, or recommendations → intent MUST be "profile". Examples: "what careers match my profile?", "show my skills", "what should I learn next?", "my career matches", "tell me about my profile".
- When the user mentions "mentor", "session", "book", or "schedule" → intent is likely "booking".
- Dates: "tomorrow", "today", "next week", weekday names like "Friday" should be resolved to actual YYYY-MM-DD dates.
- If the user mentions a mentor by name, extract it.
- If the user asks about a career path, set intent to "career_info" and extract the career name.
- If the user says something like "What can you do?" or "Help me", use "help".
- Pure greetings like "Hello" or "Hi" with nothing else → "greeting".
- Compound messages like "Hello, are there mentors available?" → "booking" (the action takes priority).
- Be precise. Return ONLY the JSON object, no markdown, no extra text.
"""

ROUTER_SYSTEM_PROMPT = ROUTER_SYSTEM_PROMPT_TEMPLATE.format(tool_block=get_tool_descriptions_block())

COMPOUND_GREETING_PATTERNS = [
    r'\b(hello|hi|hey|greetings|good morning|good afternoon|good evening)\b',
]

PURE_GREETING_PATTERN = re.compile(
    r'^(hello|hi|hey|greetings|good morning|good afternoon|good evening)[\s!.,]*$',
    re.IGNORECASE
)

HELP_PATTERNS = [
    re.compile(r'what can you (do|help)', re.IGNORECASE),
    re.compile(r'help me', re.IGNORECASE),
    re.compile(r'how (can|do) (i|you) (use|work)', re.IGNORECASE),
    re.compile(r'what (are your|features|options|capabilities)', re.IGNORECASE),
    re.compile(r'show me what', re.IGNORECASE),
    re.compile(r'^help[!.]*$', re.IGNORECASE),
]

MENTOR_BROWSE_PATTERNS = [
    re.compile(r'list\b.*\bmentor', re.IGNORECASE),
    re.compile(r'show\b.*\bmentor', re.IGNORECASE),
    re.compile(r'available\b.*\bmentor', re.IGNORECASE),
    re.compile(r'browse\b.*\bmentor', re.IGNORECASE),
    re.compile(r'find\b.*\bmentor', re.IGNORECASE),
    re.compile(r'get\b.*\bmentor', re.IGNORECASE),
    re.compile(r'who\b.*\bmentor', re.IGNORECASE),
    re.compile(r'which\b.*\bmentor', re.IGNORECASE),
    re.compile(r'any\b.*\bmentor', re.IGNORECASE),
    re.compile(r'all\b.*\bmentor', re.IGNORECASE),
]

BOOKING_MULTI_WORD = [
    re.compile(r'book a session', re.IGNORECASE),
    re.compile(r'schedule (a |an )?(session|appointment|meeting|call)', re.IGNORECASE),
    re.compile(r'meet( with| a)? (mentor|advisor|coach)', re.IGNORECASE),
    re.compile(r'available mentor', re.IGNORECASE),
    re.compile(r'session with', re.IGNORECASE),
    re.compile(r'(book|schedule) (a |an )?mentor', re.IGNORECASE),
    re.compile(r'(i want|i\'d like|i would like) to (book|schedule|speak|talk|meet)', re.IGNORECASE),
    re.compile(r'any mentor', re.IGNORECASE),
    re.compile(r'mentors? available', re.IGNORECASE),
]


def _get_last_user_message(state: Dict[str, Any]) -> str:
    """Extract the last user message content."""
    messages = state.get("messages", [])
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            return msg.content if hasattr(msg, "content") else str(msg)
        if hasattr(msg, "type") and msg.type == "human":
            return msg.content if hasattr(msg, "content") else str(msg)
    return ""


def _resolve_date(date_str: Optional[str]) -> Optional[str]:
    """Resolve relative dates like 'tomorrow' to YYYY-MM-DD."""
    if not date_str:
        return None
    from datetime import datetime, timedelta
    today = datetime.now()
    lower = date_str.lower().strip()

    if lower == "today":
        return today.strftime("%Y-%m-%d")
    if lower == "tomorrow":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")

    day_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    if lower in day_map:
        target = day_map[lower]
        days_ahead = (target - today.weekday()) % 7
        # If today is the requested weekday, return today (not next week)
        return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    if re.match(r"\d{4}-\d{2}-\d{2}", date_str):
        return date_str

    return None


def _is_compound_greeting(content: str) -> bool:
    """Check if message contains both a greeting and an action request."""
    content_lower = content.lower()
    has_greeting = any(re.search(p, content_lower) for p in COMPOUND_GREETING_PATTERNS)
    if not has_greeting:
        return False
    word_count = len(content_lower.split())
    return word_count > 3


def _detect_action_intent(content: str, state: Dict[str, Any]) -> Dict[str, Any]:
    """Detect the action intent behind a compound greeting message."""
    content_lower = content.lower()

    booking_stage = state.get("booking_stage")
    if booking_stage and booking_stage != "completed":
        return {"current_intent": Intent.BOOKING, "booking_data": state.get("booking_data"), "compound_greeting": True}

    for pattern in BOOKING_MULTI_WORD:
        if pattern.search(content_lower):
            return {"current_intent": Intent.BOOKING, "booking_data": None, "compound_greeting": True}

    for pattern in HELP_PATTERNS:
        if pattern.search(content_lower):
            return {"current_intent": Intent.HELP, "booking_data": None, "compound_greeting": True}

    search_keywords = ["what", "how", "why", "who", "where", "career", "salary", "trend", "job", "skill"]
    if any(kw in content_lower for kw in search_keywords):
        return {"current_intent": Intent.SEARCH, "booking_data": None, "compound_greeting": True}

    return {"current_intent": Intent.GENERAL, "booking_data": None, "compound_greeting": True}


async def llm_router_node(state: Dict[str, Any], orchestrator: Optional[AIOrchestrator] = None) -> Dict[str, Any]:
    """Classify intent and extract entities using the LLM.

    Falls back to keyword-based routing if the LLM is unavailable.
    """
    user_message = _get_last_user_message(state)
    if not user_message:
        return {"current_intent": Intent.GENERAL, "booking_data": None, "compound_greeting": False}

    if orchestrator is None:
        logger.warning("llm_router_node: no orchestrator, falling back to keyword routing")
        return _keyword_route(user_message, state)

    try:
        messages = [
            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ]

        response = await orchestrator.chat_with_retry(
            task="chatbot",
            messages=messages,
            temperature=0.3,
            max_tokens=400,
            retries=2,
            response_format={"type": "json_object"},
            tools=get_tool_manifest(),
        )

        message = response.get("choices", [{}])[0].get("message", {})
        content = message.get("content", "")

        # Check for native tool calls from the LLM
        tool_calls = message.get("tool_calls", [])
        if tool_calls:
            # Extract intent from the first tool call name if present
            first_tool = tool_calls[0]
            tool_name = first_tool.get("function", {}).get("name", "")
            logger.info("llm_router_node: detected tool_call=%s", tool_name)

            # Map tool names to intents
            tool_to_intent = {
                "get_available_mentors": Intent.BOOKING,
                "check_mentor_availability": Intent.BOOKING,
                "book_mentor_session": Intent.BOOKING,
                "find_mentor_by_name": Intent.BOOKING,
                "get_user_sessions": Intent.USER_SESSIONS,
                "get_mentor_details": Intent.BOOKING,
                "web_search": Intent.SEARCH,
                "search_career_info": Intent.SEARCH,
                "get_job_trends": Intent.SEARCH,
                "explain_career": Intent.CAREER_INFO,
                "get_career_recommendations": Intent.PROFILE,
                "get_career_recommendations_info": Intent.PROFILE,
                "get_user_full_profile": Intent.PROFILE,
                "get_my_career_matches": Intent.PROFILE,
                "explain_app_feature": Intent.EXPLAIN_FEATURE,
                "get_user_profile": Intent.PROFILE,
                "get_app_features": Intent.HELP,
            }
            inferred_intent = tool_to_intent.get(tool_name, Intent.GENERAL)
            return {
                "current_intent": inferred_intent,
                "booking_data": None,
                "compound_greeting": _is_compound_greeting(user_message),
                "last_tool_used": tool_name,
            }

        content = _strip_markdown_fences(content)

        if not content:
            return _keyword_route(user_message, state)

        parsed = json.loads(content)
        intent_str = parsed.get("intent", "fallback")
        entities = parsed.get("entities", {})
        confidence = parsed.get("confidence", 0.5)

        intent_map = {
            "booking": Intent.BOOKING,
            "search": Intent.SEARCH,
            "general": Intent.GENERAL,
            "greeting": Intent.GREETING,
            "help": Intent.HELP,
            "user_sessions": Intent.USER_SESSIONS,
            "explain_feature": Intent.EXPLAIN_FEATURE,
            "career_info": Intent.CAREER_INFO,
            "profile": Intent.PROFILE,
            "fallback": Intent.UNKNOWN,
        }
        intent = intent_map.get(intent_str, Intent.UNKNOWN)

        if confidence < 0.4:
            intent = Intent.UNKNOWN

        booking_data = None
        if intent == Intent.BOOKING:
            booking_data = BookingContext(
                preferred_date=_resolve_date(entities.get("date")),
                preferred_time=entities.get("time"),
                mentor_name=entities.get("mentor_name"),
                specialty=entities.get("specialty"),
            )

        is_compound = False
        if intent in (Intent.BOOKING, Intent.SEARCH, Intent.GENERAL) and _is_compound_greeting(user_message):
            is_compound = True

        logger.info(f"llm_router_node: intent={intent.value}, confidence={confidence}, compound={is_compound}")

        return {
            "current_intent": intent,
            "booking_data": booking_data,
            "compound_greeting": is_compound,
        }

    except json.JSONDecodeError as e:
        logger.error(f"llm_router_node JSON parse error: {e}, content={content[:200] if content else 'empty'}")
        return _keyword_route(user_message, state)
    except Exception as e:
        logger.error(f"llm_router_node error: {e}")
        return _keyword_route(user_message, state)


def _keyword_route(content: str, state: Dict[str, Any]) -> Dict[str, Any]:
    """Tiered keyword-based routing as fallback.

    Priority tiers:
    1. Already in a booking flow → continue booking
    2. Compound greeting + action → action intent with compound_greeting flag
    3. Pure greetings → GREETING
    4. Help requests → HELP
    5. Mentor browsing / listing → BOOKING
    6. Multi-word booking patterns → BOOKING
    7. Single booking keywords → BOOKING
    8. Confirmation keywords → CONFIRMATION
    9. Search patterns → SEARCH
    10. Default → GENERAL
    """
    content_lower = content.lower()

    # Tier 1: Already in a booking flow
    booking_stage = state.get("booking_stage")
    if booking_stage and booking_stage != "completed":
        return {"current_intent": Intent.BOOKING, "booking_data": state.get("booking_data"), "compound_greeting": False}

    # Tier 2: Compound greeting + action
    if _is_compound_greeting(content_lower):
        return _detect_action_intent(content_lower, state)

    # Tier 3: Pure greetings
    if PURE_GREETING_PATTERN.match(content_lower):
        return {"current_intent": Intent.GREETING, "booking_data": None, "compound_greeting": False}

    # Tier 4: Help requests
    for pattern in HELP_PATTERNS:
        if pattern.search(content_lower):
            return {"current_intent": Intent.HELP, "booking_data": None, "compound_greeting": False}

    # Tier 5: Mentor browsing / listing (no date needed)
    for pattern in MENTOR_BROWSE_PATTERNS:
        if pattern.search(content_lower):
            return {"current_intent": Intent.BOOKING, "booking_data": None, "compound_greeting": False}

    # Tier 6: Multi-word booking patterns
    for pattern in BOOKING_MULTI_WORD:
        if pattern.search(content_lower):
            return {"current_intent": Intent.BOOKING, "booking_data": None, "compound_greeting": False}

    # Tier 7: Single booking keywords (contextual)
    booking_singles = {"book", "schedule", "mentor", "appointment", "session", "available"}
    words = set(content_lower.split())
    if words & booking_singles:
        return {"current_intent": Intent.BOOKING, "booking_data": None, "compound_greeting": False}

    # Tier 8: Confirmation keywords (with word boundaries)
    confirmation_words = ["yes", "confirm", "ok", "okay", "sure", "go ahead", "do it",
                          "book it", "proceed", "correct", "right", "that's right", "exactly"]
    for keyword in confirmation_words:
        if re.search(r'\b' + re.escape(keyword) + r'\b', content_lower):
            return {"current_intent": Intent.CONFIRMATION, "booking_data": None, "compound_greeting": False}

    # Tier 9: Profile / personal data patterns
    profile_keywords = [
        "my profile", "my skills", "my career matches", "careers match my profile",
        "what careers match", "what should i learn", "my recommendations",
        "my career", "my quiz", "my cv", "my resume", "tell me about me",
        "who am i", "my interests", "my strengths", "my analysis",
    ]
    for keyword in profile_keywords:
        if keyword in content_lower:
            return {"current_intent": Intent.PROFILE, "booking_data": None, "compound_greeting": False}

    # Tier 10: Search / career info patterns
    search_keywords = [
        "what", "how", "why", "who", "where", "when", "tell me about",
        "explain", "search", "find", "look up", "salary", "jobs",
        "career", "demand", "trend", "market", "skills", "requirements",
        "best", "top", "in-demand", "most wanted",
    ]
    for keyword in search_keywords:
        if keyword in content_lower:
            return {"current_intent": Intent.SEARCH, "booking_data": None, "compound_greeting": False}

    # Default
    return {"current_intent": Intent.GENERAL, "booking_data": None, "compound_greeting": False}


# Legacy alias for graph builder compatibility
route_intent = llm_router_node
