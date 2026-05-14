"""Profile and career-match tools for the chatbot."""
from typing import Optional
from langchain_core.tools import tool

from app.core.database import DatabaseService


async def _get_supabase_client():
    db = await DatabaseService.create()
    return db.get_client()


@tool
async def get_user_full_profile(user_id: str) -> dict:
    """
    Get the user's full profile including declared info, CV skills, quiz results, and interests.

    Args:
        user_id: UUID of the user

    Returns:
        Dictionary with comprehensive profile data
    """
    client = await _get_supabase_client()

    # 1. Basic user profile
    user_resp = await client.from_("users").select(
        "id, email, name, education_level, field_of_study, career_goal, bio, skills, avatar"
    ).eq("id", user_id).maybe_single().execute()
    user = user_resp.data or {}

    # 2. Latest CV analysis
    cv_resp = await client.from_("cv_analysis").select(
        "id, extracted_skills, extracted_interests, summary, strengths, weaknesses, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(1).maybe_single().execute()
    cv = cv_resp.data or {}

    # 3. Latest completed quiz session
    quiz_session_resp = await client.from_("user_quiz_sessions").select(
        "id, status, score, created_at"
    ).eq("user_id", user_id).eq("status", "completed").order("created_at", desc=True).limit(1).maybe_single().execute()
    quiz_session = quiz_session_resp.data or {}

    # 4. Quiz responses for the latest session
    quiz_answers = []
    if quiz_session:
        answers_resp = await client.from_("user_quiz_responses").select(
            "question_number, question_text, selected_option"
        ).eq("session_id", quiz_session["id"]).order("question_number").execute()
        quiz_answers = answers_resp.data or []

    return {
        "success": bool(user),
        "profile": {
            "id": user.get("id"),
            "name": user.get("name"),
            "email": user.get("email"),
            "education_level": user.get("education_level"),
            "field_of_study": user.get("field_of_study"),
            "career_goal": user.get("career_goal"),
            "bio": user.get("bio"),
            "declared_skills": [s.strip() for s in user.get("skills", "").split(",") if s.strip()] if user.get("skills") else [],
            "avatar": user.get("avatar"),
        },
        "cv_analysis": {
            "id": cv.get("id"),
            "extracted_skills": cv.get("extracted_skills", []),
            "extracted_interests": cv.get("extracted_interests", []),
            "summary": cv.get("summary"),
            "strengths": cv.get("strengths", []),
            "weaknesses": cv.get("weaknesses", []),
            "created_at": cv.get("created_at"),
        } if cv else None,
        "quiz": {
            "session_id": quiz_session.get("id"),
            "score": quiz_session.get("score"),
            "answers": [
                {
                    "question": a.get("question_text"),
                    "answer": a.get("selected_option"),
                }
                for a in quiz_answers
            ],
        } if quiz_session else None,
    }


@tool
async def get_my_career_matches(user_id: str, limit: int = 5) -> dict:
    """
    Get the user's top career matches with scores and reasons.

    Args:
        user_id: UUID of the user
        limit: Number of matches to return (default 5)

    Returns:
        Dictionary with ranked career matches
    """
    client = await _get_supabase_client()

    # Fetch latest career matches joined with careers
    resp = await client.from_("career_match_results").select(
        """
        match_score,
        match_reasons,
        ai_insights,
        ranking,
        careers (
            id, title, description, category, required_skills, typical_traits,
            average_salary, salary_range_min, salary_range_max, growth_rate, demand_level
        )
        """
    ).eq("user_id", user_id).order("ranking", asc=True).limit(limit).execute()

    rows = resp.data or []

    matches = []
    for row in rows:
        career = row.get("careers", {}) or {}
        insights = row.get("ai_insights", {}) or {}
        matches.append({
            "rank": row.get("ranking"),
            "score": row.get("match_score"),
            "career": {
                "id": career.get("id"),
                "title": career.get("title"),
                "description": career.get("description"),
                "category": career.get("category"),
                "required_skills": career.get("required_skills", []),
                "typical_traits": career.get("typical_traits", []),
                "average_salary": career.get("average_salary"),
                "salary_range_min": career.get("salary_range_min"),
                "salary_range_max": career.get("salary_range_max"),
                "growth_rate": career.get("growth_rate"),
                "demand_level": career.get("demand_level"),
            },
            "match_reasons": row.get("match_reasons", []),
            "ai_explanation": insights.get("explanation") if isinstance(insights, dict) else None,
        })

    return {
        "success": bool(matches),
        "matches": matches,
        "count": len(matches),
        "user_id": user_id,
    }
