"""
Tools package for AI v2 module.

Provides a suite of tools that agents can call to perform specific tasks.
Tools are independent, reusable functions that can be invoked by agents or the orchestrator.
"""

from .base import (
    retrieve_documents,
    extract_skills,
    get_career_requirements,
    compute_skill_gap,
    generate_roadmap,
)
from .registry import TOOLS, get_tool, list_tools, call_tool

__all__ = [
    # Tools
    "retrieve_documents",
    "extract_skills",
    "get_career_requirements",
    "compute_skill_gap",
    "generate_roadmap",
    # Registry
    "TOOLS",
    "get_tool",
    "list_tools",
    "call_tool",
]
