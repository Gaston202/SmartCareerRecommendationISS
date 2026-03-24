"""
Tool definitions for LLM function calling.

Defines available tools that the LLM can call to make intelligent decisions
about career recommendations, skill gaps, and learning paths.
"""

from typing import Any, Dict, List

# Tool definitions for OpenAI Function Calling API
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "extract_skills_from_profile",
            "description": (
                "Extract and analyze user's current skills with proficiency levels "
                "from their profile and CV. Returns structured skill data."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "Unique identifier of the user"
                    },
                    "include_proficiency": {
                        "type": "boolean",
                        "description": "Whether to include proficiency levels (default: true)"
                    }
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_career_requirements",
            "description": (
                "Retrieve the required skills, experience level, and competencies "
                "for a specific career role from the knowledge base."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "career_role": {
                        "type": "string",
                        "description": "Target career role (e.g., 'Backend Engineer', 'Data Scientist')"
                    },
                    "include_salary": {
                        "type": "boolean",
                        "description": "Whether to include salary and market data (default: false)"
                    }
                },
                "required": ["career_role"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compute_skill_gap",
            "description": (
                "Analyze the gap between user's current skills and target career requirements. "
                "Returns gap analysis with priority scoring."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "current_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of user's current skills"
                    },
                    "required_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of skills required for target role"
                    },
                    "include_learning_time": {
                        "type": "boolean",
                        "description": "Whether to include estimated learning time per skill (default: true)"
                    }
                },
                "required": ["current_skills", "required_skills"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_learning_roadmap",
            "description": (
                "Generate a structured learning roadmap to transition from current skills "
                "to target career role with milestones and resources."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target_role": {
                        "type": "string",
                        "description": "Target career role"
                    },
                    "missing_skills": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Skills the user needs to learn"
                    },
                    "current_level": {
                        "type": "string",
                        "enum": ["junior", "mid", "senior"],
                        "description": "User's current experience level"
                    }
                },
                "required": ["target_role", "missing_skills", "current_level"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "retrieve_career_resources",
            "description": (
                "Search the knowledge base for learning resources, courses, and documentation "
                "relevant to specific skills or career paths."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (skill name, topic, or career role)"
                    },
                    "resource_type": {
                        "type": "string",
                        "enum": ["course", "article", "tutorial", "book", "project", "community", "all"],
                        "description": "Type of resources to retrieve (default: all)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 5)"
                    }
                },
                "required": ["query"]
            }
        }
    }
]


def get_tool_definition(tool_name: str) -> Dict[str, Any]:
    """
    Get a specific tool definition by name.
    
    Args:
        tool_name (str): Name of the tool
        
    Returns:
        Dict: Tool definition or None if not found
    """
    for tool in TOOL_DEFINITIONS:
        if tool["function"]["name"] == tool_name:
            return tool
    return None


def get_tool_names() -> List[str]:
    """Get list of all available tool names."""
    return [tool["function"]["name"] for tool in TOOL_DEFINITIONS]
