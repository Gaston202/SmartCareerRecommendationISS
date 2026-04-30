from langgraph.graph import add_messages
from langchain_core.messages import AIMessage

from app.agents.chatbot.schemas.pydantic import Intent


def create_response_message(state: dict, content: str):
    """Create an AIMessage response."""
    return [AIMessage(content=content)]


def greeting_node(state: dict) -> dict:
    """Handle pure greeting messages with a friendly welcome."""
    has_history = len(state.get("messages", [])) > 2

    if has_history:
        response_content = "Hello again! What can I help you with?"
    else:
        import random
        greeting_responses = [
            "Hello! I'm your career assistant. I can help you with:\n\n"
            "Book mentor sessions, search career information, check job market trends, "
            "or review your upcoming sessions.\n\n"
            "What can I help you with today?",

            "Hi there! I'm here to help you navigate your career journey. "
            "I can schedule mentor sessions, research careers, check job trends, "
            "and more. Just let me know what you need!",

            "Welcome! I'm your personal career assistant. "
            "I can help with mentor booking, career research, job trends, "
            "and your learning roadmap. How can I assist you today?",
        ]
        response_content = random.choice(greeting_responses)

    return {
        "messages": create_response_message(state, response_content),
        "current_intent": Intent.GREETING,
    }


def help_node(state: dict) -> dict:
    """Provide detailed help about chatbot capabilities."""
    help_text = (
        "Here's everything I can help you with:\n\n"
        "**Mentor Sessions**\n"
        "- 'Book a session with a mentor on Wednesday'\n"
        "- 'Find available mentors for tomorrow'\n"
        "- 'Show my upcoming sessions'\n\n"
        "**Career Information**\n"
        "- 'What jobs are in demand right now?'\n"
        "- 'Tell me about machine learning careers'\n"
        "- 'What's the salary for a frontend developer?'\n\n"
        "**Job Market Research**\n"
        "- 'What are the top tech skills to learn?'\n"
        "- 'How is the cybersecurity job market?'\n"
        "- 'What programming languages are most wanted?'\n\n"
        "**Career Guidance**\n"
        "- 'What careers match my profile?'\n"
        "- 'How do I become a data scientist?'\n"
        "- 'What should I learn for a career in AI?'\n\n"
        "Just ask me anything!"
    )

    return {
        "messages": create_response_message(state, help_text),
        "current_intent": Intent.HELP,
    }


def fallback_node(state: dict) -> dict:
    """
    Handle unrecognized requests gracefully.

    Provides helpful guidance when intent cannot be determined.
    """
    messages = state.get("messages", [])
    content = messages[-1].content if messages and hasattr(messages[-1], 'content') else ""

    fallback_responses = [
        "I'm not sure I understood that. Could you rephrase? For example:\n"
        "• 'Book a mentor session for tomorrow'\n"
        "• 'What are the most in-demand IT jobs?'\n"
        "• 'Show my career matches'\n\n"
        "I can help with mentor booking, career information, and job market research!",

        "I didn't quite get that. Let me help you with one of these:\n\n"
        "📅 **Booking** - 'I want to meet with a mentor'\n"
        "🔍 **Information** - 'What jobs are trending?'\n"
        "📋 **Sessions** - 'Show my upcoming sessions'\n\n"
        "What would you like to do?",

        f"Hmm, I'm not sure how to help with that. \n\n"
        "I specialize in:\n"
        "• Booking mentor sessions\n"
        "• Career and job information\n"
        "• Job market trends\n\n"
        "Try asking me something like 'What careers are in demand?' or 'Book a mentor for Wednesday at 10am'"
    ]

    import random
    response_content = random.choice(fallback_responses)

    return {
        "messages": create_response_message(state, response_content),
        "current_intent": Intent.UNKNOWN,
    }


async def user_sessions_node(state: dict) -> dict:
    """
    Display user's upcoming mentor sessions.

    Uses get_user_sessions tool to fetch and display sessions.
    """
    user_id = state.get("user_id")

    if not user_id:
        return {
            "messages": create_response_message(state, "I need to know your user ID to show your sessions. Are you logged in?"),
            "current_intent": Intent.GENERAL
        }

    from app.agents.chatbot.tools.booking import get_user_sessions

    result = await get_user_sessions.ainvoke({"user_id": user_id, "status": "scheduled"})

    sessions = result.get("sessions", [])

    if not sessions:
        return {
            "messages": create_response_message(state, "You don't have any upcoming mentor sessions. Would you like to book one? Just say 'I want to meet with a mentor'"),
            "current_intent": Intent.GENERAL
        }

    response_content = "Here are your upcoming mentor sessions:\n\n"

    for i, session in enumerate(sessions[:5], 1):
        mentor = session.get("mentor", {})
        mentor_name = mentor.get("name", "Mentor")
        scheduled = session.get("scheduled_at", "TBD")
        title = session.get("title", "Session")

        response_content += f"**{i}. {title}**\n"
        response_content += f"   Mentor: {mentor_name}\n"
        response_content += f"   When: {scheduled}\n"
        response_content += f"   Duration: {session.get('duration_minutes', 30)} minutes\n\n"

    return {
        "messages": create_response_message(state, response_content),
        "current_intent": Intent.GENERAL,
        "last_tool_used": "get_user_sessions"
    }


def explain_feature_node(state: dict) -> dict:
    """
    Explain a specific app feature in detail.

    Uses explain_app_feature tool for feature explanations.
    """
    messages = state.get("messages", [])
    content = messages[-1].content if messages and hasattr(messages[-1], 'content') else ""

    from app.agents.chatbot.tools.general import explain_app_feature

    feature = extract_feature_name(content)

    if not feature:
        return {
            "messages": create_response_message(state, "Which feature would you like to know about? I can explain: quiz, mentors, roadmap, or careers"),
            "current_intent": Intent.GENERAL
        }

    result = explain_app_feature.invoke({"feature": feature})

    if result.get("success"):
        feature_data = result.get("feature", {})
        response_content = (
            f"**{feature_data.get('title', feature)}**\n\n"
            f"{feature_data.get('description', '')}\n\n"
            f"**How to use:** {feature_data.get('how_to', '')}\n\n"
            f"**Benefits:** {', '.join(feature_data.get('benefits', []))}"
        )
    else:
        response_content = result.get("error", "I couldn't find that feature")

    return {
        "messages": create_response_message(state, response_content),
        "current_intent": Intent.GENERAL,
        "last_tool_used": "explain_app_feature"
    }


def extract_feature_name(content: str) -> str | None:
    """Extract feature name from user message."""
    content_lower = content.lower()

    feature_names = ["quiz", "mentor", "mentors", "roadmap", "learning roadmap", "career", "careers"]

    for feature in feature_names:
        if feature in content_lower:
            return feature

    return None