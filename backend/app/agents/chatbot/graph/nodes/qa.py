"""QA and search nodes for the chatbot, now with LLM answer synthesis."""
import logging
import re
from typing import Dict, Any, Optional
from langchain_core.messages import AIMessage

from app.agents.chatbot.schemas.pydantic import Intent
from app.core.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)


def search_node(state: dict) -> dict:
    """
    Perform web search based on user query.

    Extracts query from the last user message and calls web_search tool.
    Stores results in search_data.
    """
    messages = state.get("messages", [])
    content = messages[-1].content if messages and hasattr(messages[-1], 'content') else ""

    from app.agents.chatbot.tools.search import web_search

    query = content

    career_keywords = ["career", "job", "profession", "role"]
    trend_keywords = ["trend", "demand", "in-demand", "most wanted", "popular"]
    salary_keywords = ["salary", "pay", "compensation", "earning"]

    # Only append year if user didn't already include one
    has_year = bool(re.search(r"\b20\d{2}\b", content))

    if not has_year:
        if any(kw in content.lower() for kw in career_keywords + trend_keywords):
            query = f"{content} 2026"
        elif any(kw in content.lower() for kw in salary_keywords):
            query = f"{content} 2026"
        elif "?" not in content and len(content.split()) < 5:
            query = f"{content} 2026 information"

    result = web_search.invoke({"query": query, "max_results": 5})

    search_data = state.get("search_data") or {}
    search_data["query"] = query
    search_data["results"] = result.get("results", [])

    return {
        "messages": [],
        "search_data": search_data,
        "current_intent": Intent.SEARCH,
        "last_tool_used": "web_search"
    }


async def format_answer_node(state: dict, orchestrator: Optional[AIOrchestrator] = None) -> dict:
    """Format search results into a natural, readable response using the LLM."""
    search_data = state.get("search_data", {})
    results = search_data.get("results", [])
    query = search_data.get("query", "")

    if not results:
        return {
            "messages": [AIMessage(content=f"I searched for '{query}' but couldn't find any relevant information. Could you try rephrasing your question?")],
            "search_data": search_data,
            "current_intent": Intent.SEARCH,
        }

    if orchestrator is None:
        # Fallback to basic formatting
        response_content = f"Based on my search for '{query}', here's what I found:\n\n"
        for i, result in enumerate(results[:3], 1):
            title = result.get("title", "No title")
            url = result.get("url", "")
            snippet = result.get("snippet", "")
            response_content += f"**{i}. {title}**\n"
            if snippet:
                response_content += f"{snippet[:200]}...\n"
            if url:
                response_content += f"[Source]({url})\n"
            response_content += "\n"
        return {
            "messages": [AIMessage(content=response_content)],
            "search_data": search_data,
            "current_intent": Intent.SEARCH,
        }

    try:
        # Build search context for LLM
        search_context = f"Search query: {query}\n\nResults:\n"
        for i, result in enumerate(results[:5], 1):
            title = result.get("title", "")
            snippet = result.get("snippet", "")
            url = result.get("url", "")
            search_context += f"{i}. {title}\n   {snippet[:300]}\n   URL: {url}\n\n"

        messages = [
            {"role": "system", "content": "You are a career research assistant. Synthesize search results into a helpful, concise answer. Use markdown formatting. Cite sources by referencing the result number. Keep responses to 3-5 sentences unless the user asks for detail."},
            {"role": "user", "content": search_context + "\nPlease provide a helpful answer based on these search results."},
        ]

        response = await orchestrator.chat_with_retry(
            task="chatbot",
            messages=messages,
            temperature=0.6,
            max_tokens=800,
            retries=2,
        )

        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            content = f"I found {len(results)} results for '{query}' but couldn't summarize them."

        return {
            "messages": [AIMessage(content=content)],
            "search_data": search_data,
            "current_intent": Intent.SEARCH,
        }
    except Exception as e:
        logger.error(f"format_answer_node LLM error: {e}")
        return {
            "messages": [AIMessage(content=f"I found some results for '{query}' but couldn't format them properly. Let me know if you'd like me to try again.")],
            "search_data": search_data,
            "current_intent": Intent.SEARCH,
            "error_message": str(e),
        }


def career_info_node(state: dict) -> dict:
    """
    Get detailed career information for a specific career.

    Searches for career details when user asks about a specific career path.
    """
    messages = state.get("messages", [])
    content = messages[-1].content if messages and hasattr(messages[-1], 'content') else ""

    from app.agents.chatbot.tools.search import explain_career

    career_name = extract_career_name(content)

    if not career_name:
        return {
            "messages": [AIMessage(content="I'd be happy to help you explore a career path! Which career are you interested in? (e.g., 'Tell me about data science')")],
            "current_intent": Intent.SEARCH,
        }

    result = explain_career.invoke(career_name)
    results = result.get("information", []) if result.get("success") else []

    if not results:
        return {
            "messages": [AIMessage(content=f"I couldn't find specific information about {career_name}. Could you try a more specific career name?")],
            "current_intent": Intent.SEARCH,
        }

    response_content = f"Here's what I found about **{career_name}** careers:\n\n"
    for i, result in enumerate(results[:3], 1):
        title = result.get("title", "")
        snippet = result.get("snippet", "")
        response_content += f"**{i}. {title}**\n"
        if snippet:
            response_content += f"{snippet[:200]}...\n\n"

    response_content += f"\nWould you like more information about how to get into {career_name}?"

    return {
        "messages": [AIMessage(content=response_content)],
        "current_intent": Intent.SEARCH,
        "last_tool_used": "explain_career"
    }


def extract_career_name(content: str) -> str | None:
    """Extract career name from user message."""
    content_lower = content.lower()

    career_patterns = [
        "data scientist", "data engineer", "machine learning", "ml engineer",
        "frontend developer", "backend developer", "full stack", "fullstack",
        "web developer", "software engineer", "devops", "cloud engineer",
        "mobile developer", "ios developer", "android developer", "react developer",
        "python developer", "java developer", "javascript developer",
        "cybersecurity", "security analyst", "product manager", "ux designer",
        "ui designer", "data analyst", "business analyst"
    ]

    for pattern in career_patterns:
        if pattern in content_lower:
            return pattern.replace("ml engineer", "machine learning engineer")

    words = content.split()
    stop_words = ["tell", "me", "about", "what", "is", "a", "an", "the", "career", "job", "role", "in", "for", "how", "to", "become", "be", "a"]
    career_words = [w for w in words if w.lower() not in stop_words and len(w) > 2]

    if career_words:
        return " ".join(career_words[:3])

    return None
