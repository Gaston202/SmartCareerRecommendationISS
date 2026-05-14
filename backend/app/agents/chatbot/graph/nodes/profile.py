"""Profile node for the chatbot — fetches and formats user profile data."""
import logging
from langchain_core.messages import AIMessage

from app.agents.chatbot.schemas.pydantic import Intent

logger = logging.getLogger(__name__)


def _create_message(content: str):
    return [AIMessage(content=content)]


def _detect_profile_query(content: str) -> str:
    """Detect what aspect of the profile the user is asking about."""
    content_lower = content.lower()

    if any(kw in content_lower for kw in ["career match", "careers match", "match my profile", "my career matches", "what careers", "what job", "what role", "recommendation"]):
        return "career_matches"

    if any(kw in content_lower for kw in ["my skills", "what skills", "skill", "strengths", "weaknesses"]):
        return "skills"

    if any(kw in content_lower for kw in ["what should i learn", "learn next", "roadmap", "what to learn"]):
        return "learning"

    if any(kw in content_lower for kw in ["my profile", "about me", "who am i", "tell me about me", "my info"]):
        return "profile"

    if any(kw in content_lower for kw in ["my quiz", "quiz result", "assessment"]):
        return "quiz"

    if any(kw in content_lower for kw in ["my cv", "my resume", "cv analysis"]):
        return "cv"

    return "career_matches"  # Default: show career matches


async def profile_node(state: dict) -> dict:
    """Fetch and format user profile data based on the query."""
    user_id = state.get("user_id")
    messages = state.get("messages", [])
    content = messages[-1].content if messages and hasattr(messages[-1], "content") else ""

    if not user_id:
        return {
            "messages": _create_message("I need to know your user ID to show your profile. Are you logged in?"),
            "current_intent": Intent.PROFILE,
        }

    query_type = _detect_profile_query(content)

    try:
        from app.agents.chatbot.tools.profile import get_user_full_profile, get_my_career_matches

        if query_type == "career_matches":
            result = await get_my_career_matches.ainvoke({"user_id": user_id, "limit": 5})
            matches = result.get("matches", [])

            if not matches:
                return {
                    "messages": _create_message(
                        "I couldn't find any career matches for your profile yet. "
                        "Try completing the career quiz and uploading your CV to get personalized recommendations!"
                    ),
                    "current_intent": Intent.PROFILE,
                    "last_tool_used": "get_my_career_matches",
                }

            response = "Based on your profile, here are your top career matches:\n\n"
            for m in matches:
                career = m.get("career", {})
                title = career.get("title", "Career")
                score = m.get("score", 0)
                reasons = m.get("match_reasons", [])
                ai_exp = m.get("ai_explanation")

                response += f"**{m.get('rank', '?')}. {title}** — {score}% match\n"
                if reasons:
                    response += f"   Why: {', '.join(reasons[:2])}\n"
                if ai_exp:
                    response += f"   Insight: {ai_exp[:120]}...\n" if len(ai_exp) > 120 else f"   Insight: {ai_exp}\n"
                if career.get("average_salary"):
                    response += f"   Avg Salary: ${career['average_salary']:,}\n"
                response += "\n"

            response += "Would you like more details about any of these careers, or help booking a mentor in one of these fields?"
            return {
                "messages": _create_message(response),
                "current_intent": Intent.PROFILE,
                "last_tool_used": "get_my_career_matches",
                "profile_data": result,
            }

        if query_type == "skills":
            result = await get_user_full_profile.ainvoke({"user_id": user_id})
            profile_data = result.get("profile", {})
            cv = result.get("cv_analysis", {}) or {}
            quiz = result.get("quiz", {}) or {}

            declared = profile_data.get("declared_skills", [])
            extracted = cv.get("extracted_skills", [])
            all_skills = list(dict.fromkeys(declared + extracted))

            if not all_skills:
                return {
                    "messages": _create_message(
                        "I don't see any skills in your profile yet. "
                        "Upload your CV or complete the career quiz so I can analyze your skills!"
                    ),
                    "current_intent": Intent.PROFILE,
                    "last_tool_used": "get_user_full_profile",
                }

            response = "Here's what I know about your skills:\n\n"
            if declared:
                response += f"**Declared skills:** {', '.join(declared[:10])}\n\n"
            if extracted:
                response += f"**Extracted from your CV:** {', '.join(extracted[:10])}\n\n"
            if cv.get("strengths"):
                response += f"**Strengths:** {', '.join(cv['strengths'][:5])}\n\n"
            if cv.get("weaknesses"):
                response += f"**Areas to improve:** {', '.join(cv['weaknesses'][:5])}\n\n"

            response += "Would you like to see career paths that match these skills?"
            return {
                "messages": _create_message(response),
                "current_intent": Intent.PROFILE,
                "last_tool_used": "get_user_full_profile",
            }

        if query_type == "learning":
            result = await get_my_career_matches.ainvoke({"user_id": user_id, "limit": 3})
            matches = result.get("matches", [])

            if not matches:
                return {
                    "messages": _create_message(
                        "I need your quiz results and CV to suggest what to learn next. "
                        "Complete the career quiz and upload your CV for personalized learning recommendations!"
                    ),
                    "current_intent": Intent.PROFILE,
                }

            top = matches[0].get("career", {})
            required = top.get("required_skills", [])
            response = f"Your top match is **{top.get('title', 'a career')}**.\n\n"
            if required:
                response += f"Key skills to develop for this path:\n"
                for skill in required[:5]:
                    response += f"- {skill}\n"
                response += "\nWould you like me to generate a learning roadmap for this career?"
            else:
                response += "Would you like me to suggest a learning roadmap based on your top match?"

            return {
                "messages": _create_message(response),
                "current_intent": Intent.PROFILE,
                "last_tool_used": "get_my_career_matches",
            }

        # Default: general profile summary
        result = await get_user_full_profile.ainvoke({"user_id": user_id})
        profile_data = result.get("profile", {})
        cv = result.get("cv_analysis", {}) or {}
        quiz = result.get("quiz", {}) or {}

        response = f"**Your Profile**\n\n"
        if profile_data.get("name"):
            response += f"Name: {profile_data['name']}\n"
        if profile_data.get("education_level"):
            response += f"Education: {profile_data['education_level']}\n"
        if profile_data.get("field_of_study"):
            response += f"Field of Study: {profile_data['field_of_study']}\n"
        if profile_data.get("career_goal"):
            response += f"Career Goal: {profile_data['career_goal']}\n"

        declared = profile_data.get("declared_skills", [])
        extracted = cv.get("extracted_skills", [])
        all_skills = list(dict.fromkeys(declared + extracted))
        if all_skills:
            response += f"\n**Skills:** {', '.join(all_skills[:8])}\n"

        if quiz:
            response += f"\nQuiz completed: Yes ({len(quiz.get('answers', []))} questions)\n"

        if cv:
            response += f"CV analyzed: Yes\n"

        response += "\nAsk me about your **career matches**, **skills**, or **what to learn next**!"
        return {
            "messages": _create_message(response),
            "current_intent": Intent.PROFILE,
            "last_tool_used": "get_user_full_profile",
            "profile_data": result,
        }

    except Exception as e:
        logger.error(f"profile_node error: {type(e).__name__}: {e}", exc_info=True)
        return {
            "messages": _create_message(
                "I had trouble loading your profile. Please make sure you're logged in and have completed the quiz or uploaded your CV."
            ),
            "current_intent": Intent.PROFILE,
            "error_message": str(e)[:200],
        }
