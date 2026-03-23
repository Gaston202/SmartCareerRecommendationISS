"""
Tool registry for AI v2 module.

Central registry that maps tool names to implementations.
Tools can be discovered, called, and managed through this registry.
"""

from typing import Callable, Dict, Any, List
from .base import (
    retrieve_documents,
    extract_skills,
    get_career_requirements,
    compute_skill_gap,
    generate_roadmap,
)
from ..utils import get_logger

logger = get_logger(__name__)


# ============================================================================
# Tool Registry - Dictionary mapping tool names to functions
# ============================================================================

TOOLS: Dict[str, Callable] = {
    "retrieve_documents": retrieve_documents,
    "extract_skills": extract_skills,
    "get_career_requirements": get_career_requirements,
    "compute_skill_gap": compute_skill_gap,
    "generate_roadmap": generate_roadmap,
}

# Tool metadata for describing what each tool does
TOOL_METADATA: Dict[str, Dict[str, Any]] = {
    "retrieve_documents": {
        "description": "Retrieve relevant career documents from the knowledge base",
        "input_params": ["query: str", "top_k: int"],
        "output": "Dict with retrieved documents and relevance scores",
        "category": "rag",
    },
    "extract_skills": {
        "description": "Extract skills from CV text",
        "input_params": ["cv_text: str"],
        "output": "Dict with extracted skills and categories",
        "category": "cv_analysis",
    },
    "get_career_requirements": {
        "description": "Fetch skill and experience requirements for a job role",
        "input_params": ["role: str"],
        "output": "Dict with role requirements, salary, market demand",
        "category": "career_data",
    },
    "compute_skill_gap": {
        "description": "Analyze the gap between user skills and required skills",
        "input_params": ["user_skills: List[str]", "required_skills: List[str]"],
        "output": "Dict with gap analysis, priority skills, coverage score",
        "category": "analysis",
    },
    "generate_roadmap": {
        "description": "Generate a phased learning roadmap for skill acquisition",
        "input_params": ["missing_skills: List[str]", "target_role: str", "current_experience: str"],
        "output": "Dict with learning phases, resources, timeline",
        "category": "planning",
    },
}


# ============================================================================
# Tool Registry Functions - Utility functions for tool management
# ============================================================================

def get_tool(tool_name: str) -> Callable:
    """
    Get a tool function by name.
    
    Args:
        tool_name (str): Name of the tool to retrieve
    
    Returns:
        Callable: The tool function
    
    Raises:
        ValueError: If tool doesn't exist
    
    Example:
        >>> tool = get_tool("extract_skills")
        >>> result = tool("Software Engineer with Python experience")
    """
    if tool_name not in TOOLS:
        available = list(TOOLS.keys())
        raise ValueError(
            f"Tool '{tool_name}' not found. Available tools: {available}"
        )
    
    logger.debug(f"Retrieved tool: {tool_name}")
    return TOOLS[tool_name]


def list_tools() -> List[str]:
    """
    List all available tools.
    
    Returns:
        List[str]: List of tool names
    
    Example:
        >>> tools = list_tools()
        >>> print(tools)
        ["retrieve_documents", "extract_skills", ...]
    """
    return list(TOOLS.keys())


def get_tool_info(tool_name: str) -> Dict[str, Any]:
    """
    Get information about a specific tool.
    
    Args:
        tool_name (str): Name of the tool
    
    Returns:
        Dict[str, Any]: Tool metadata (description, params, output, category)
    
    Raises:
        ValueError: If tool doesn't exist
    
    Example:
        >>> info = get_tool_info("extract_skills")
        >>> print(info["description"])
        "Extract skills from CV text"
    """
    if tool_name not in TOOL_METADATA:
        raise ValueError(f"Tool '{tool_name}' metadata not found")
    
    return TOOL_METADATA[tool_name]


def list_tools_info() -> List[Dict[str, Any]]:
    """
    Get information about all available tools.
    
    Returns:
        List[Dict[str, Any]]: List of all tool metadata
    
    Example:
        >>> all_tools = list_tools_info()
        >>> for tool in all_tools:
        ...     print(f"{tool['tool_name']}: {tool['description']}")
    """
    return [
        {"tool_name": name, **TOOL_METADATA[name]}
        for name in TOOLS.keys()
    ]


def call_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """
    Call a tool with the provided arguments.
    
    This is the main interface for calling tools programmatically.
    
    Args:
        tool_name (str): Name of the tool to call
        **kwargs: Arguments to pass to the tool
    
    Returns:
        Dict[str, Any]: Tool output
    
    Raises:
        ValueError: If tool doesn't exist
        Exception: If tool execution fails
    
    Example:
        >>> result = call_tool("extract_skills", cv_text="Software engineer with Python...")
        >>> print(result["skills"])
    """
    try:
        tool = get_tool(tool_name)
        logger.info(f"Calling tool: {tool_name} with args: {kwargs.keys()}")
        
        result = tool(**kwargs)
        
        if isinstance(result, dict) and result.get("success", True):
            logger.info(f"Tool {tool_name} executed successfully")
        else:
            logger.warning(f"Tool {tool_name} returned non-success result")
        
        return result
    
    except TypeError as e:
        logger.error(f"Tool {tool_name} argument error: {str(e)}")
        raise ValueError(f"Invalid arguments for tool {tool_name}: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error calling tool {tool_name}: {str(e)}")
        raise


# ============================================================================
# Tool Calling Simulation - For testing and demonstration
# ============================================================================

def simulate_tool_call(tool_name: str, **kwargs) -> Dict[str, Any]:
    """
    Simulate a tool call with logging and debugging info.
    
    Useful for testing and demonstrating tool calling flow.
    
    Args:
        tool_name (str): Name of the tool
        **kwargs: Arguments to pass to the tool
    
    Returns:
        Dict[str, Any]: Tool output with metadata
    
    Example:
        >>> result = simulate_tool_call("retrieve_documents", query="backend engineer")
        >>> print(f"Tool: {result['tool_name']}")
        >>> print(f"Execution time: {result['execution_time']}ms")
    """
    import time
    
    start_time = time.time()
    
    try:
        tool_output = call_tool(tool_name, **kwargs)
        execution_time = (time.time() - start_time) * 1000  # ms
        
        return {
            "tool_name": tool_name,
            "arguments": kwargs,
            "output": tool_output,
            "execution_time_ms": round(execution_time, 2),
            "status": "success",
        }
    
    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"Tool call simulation failed: {str(e)}")
        
        return {
            "tool_name": tool_name,
            "arguments": kwargs,
            "error": str(e),
            "execution_time_ms": round(execution_time, 2),
            "status": "failed",
        }
