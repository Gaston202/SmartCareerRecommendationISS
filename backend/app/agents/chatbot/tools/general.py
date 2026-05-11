from typing import Optional
from langchain_core.tools import tool


@tool
def get_user_profile(user_id: str) -> dict:
    """
    Get user profile information from the database.

    Args:
        user_id: UUID of the user

    Returns:
        Dictionary with user profile data
    """
    import asyncio

    async def _get():
        from app.core.database import DatabaseService
        db = await DatabaseService.create()
        client = db.get_client()

        response = await client.from_("users").select("*").eq("id", user_id).execute()

        if response.data:
            user = response.data[0]
            return {
                "success": True,
                "user": {
                    "id": user["id"],
                    "email": user.get("email"),
                    "name": user.get("name"),
                    "created_at": user.get("created_at")
                }
            }
        return {"success": False, "error": "User not found"}

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(_get())


@tool
def get_app_features() -> dict:
    """
    Get list of features and capabilities the chatbot can help with.

    Returns:
        Dictionary describing all chatbot capabilities
    """
    return {
        "success": True,
        "features": {
            "booking": {
                "description": "Schedule sessions with mentors",
                "examples": [
                    "Book a mentor session on Wednesday",
                    "Find available mentors for tomorrow",
                    "I want to talk to a career mentor"
                ],
                "slots": ["date", "time", "mentor_name", "specialty"]
            },
            "search": {
                "description": "Search for career and job market information",
                "examples": [
                    "What are the most in-demand IT jobs?",
                    "Tell me about data science careers",
                    "What's the salary for a frontend developer?"
                ],
                "topics": ["career_info", "salary", "job_trends", "skills"]
            },
            "sessions": {
                "description": "Manage your upcoming mentor sessions",
                "examples": [
                    "Show my upcoming sessions",
                    "Who is my mentor?",
                    "What's my next session?"
                ]
            },
            "career": {
                "description": "Get career recommendations and guidance",
                "examples": [
                    "What careers match my profile?",
                    "Show my career matches",
                    "What should I learn next?"
                ]
            },
            "general": {
                "description": "General questions and app assistance",
                "examples": [
                    "What can you help me with?",
                    "How do I use this app?",
                    "Show me my profile"
                ]
            }
        },
        "capabilities": [
            "Schedule mentor sessions",
            "Check mentor availability",
            "Search job market trends",
            "Get career information",
            "View upcoming sessions",
            "Explain career paths",
            "Answer general questions"
        ]
    }


@tool
def get_career_recommendations(user_id: str) -> dict:
    """
    Get personalized career recommendations for a user.

    Args:
        user_id: UUID of the user

    Returns:
        Dictionary with career recommendations based on user profile
    """
    import asyncio

    async def _get():
        try:
            from app.modules.career.service import CareerService

            career_service = CareerService()
            recommendations = await career_service.get_career_recommendations(user_id)

            return {
                "success": True,
                "recommendations": recommendations
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "recommendations": []
            }

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(_get())


@tool
def explain_app_feature(feature: str) -> dict:
    """
    Explain how to use a specific app feature.

    Args:
        feature: Name of the feature to explain (booking, quiz, roadmap, etc.)

    Returns:
        Dictionary with feature explanation and usage instructions
    """
    features = {
        "quiz": {
            "title": "Career Assessment Quiz",
            "description": "Our AI-powered career quiz analyzes your skills, interests, and personality to recommend ideal career paths.",
            "how_to": "Go to the Quiz tab and start the quiz. Answer 10 questions about your preferences and work style.",
            "benefits": ["Personalized career recommendations", "Understand your work style", "Get skill gap analysis"]
        },
        "mentors": {
            "title": "Mentor Sessions",
            "description": "Connect with industry professionals for career guidance and advice.",
            "how_to": "Browse mentors, check availability, and book a session that fits your schedule.",
            "benefits": ["Expert guidance", "Networking opportunities", "Career insights"]
        },
        "roadmap": {
            "title": "Learning Roadmaps",
            "description": "Personalized learning paths to help you acquire skills for your target career.",
            "how_to": "View your career matches and generate a learning roadmap for any career path.",
            "benefits": ["Structured learning", "Skill tracking", "Course recommendations"]
        },
        "careers": {
            "title": "Career Discovery",
            "description": "Explore different career paths and find jobs that match your profile.",
            "how_to": "Check your career matches or browse all available careers in the Careers tab.",
            "benefits": ["Job market insights", "Salary information", "Skill requirements"]
        }
    }

    feature_lower = feature.lower().strip()
    if feature_lower in features:
        return {
            "success": True,
            "feature": features[feature_lower]
        }
    return {
        "success": False,
        "error": f"Feature '{feature}' not found",
        "available_features": list(features.keys())
    }