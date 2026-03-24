"""
Fallback and error handling utilities for AI v2 module.

Provides safe data transformations, deduplication, and error categorization
to enable graceful fallback from LLM failures while maintaining data integrity.
"""

from typing import List, Dict, Any, Set, TypeVar, Callable, Optional
from dataclasses import dataclass
from enum import Enum
import json

from ..utils import get_logger

logger = get_logger(__name__)

T = TypeVar('T')


class LLMErrorType(str, Enum):
    """Classification of LLM errors for appropriate fallback handling."""
    API_KEY_INVALID = "api_key_invalid"
    RATE_LIMIT = "rate_limit"
    QUOTA_EXCEEDED = "quota_exceeded"
    MODEL_NOT_FOUND = "model_not_found"
    CONTEXT_LENGTH = "context_length"
    PARSE_ERROR = "parse_error"
    TIMEOUT = "timeout"
    NETWORK_ERROR = "network_error"
    UNKNOWN = "unknown"


@dataclass
class LLMError:
    """Structured representation of LLM error for tracking and fallback."""
    error_type: LLMErrorType
    original_message: str
    status_code: Optional[int] = None
    retry_after: Optional[int] = None
    
    def __str__(self) -> str:
        msg = f"[{self.error_type.value.upper()}] {self.original_message}"
        if self.retry_after:
            msg += f" (retry after {self.retry_after}s)"
        return msg


def categorize_llm_error(error: Exception) -> LLMError:
    """
    Categorize OpenAI exceptions into structured error types.
    
    Args:
        error: Exception from OpenAI client or general Exception
    
    Returns:
        LLMError with categorized error type for appropriate handling
    
    Example:
        >>> try:
        ...     response = client.chat.completions.create(...)
        ... except Exception as e:
        ...     llm_error = categorize_llm_error(e)
        ...     logger.error(f"LLM failed: {llm_error}")
    """
    error_msg = str(error).lower()
    
    # Check for specific OpenAI error types
    try:
        # Handle RateLimitError, APIError, etc. from openai library
        error_type = type(error).__name__.lower()
        
        if "ratelimit" in error_type or "429" in error_msg:
            return LLMError(
                error_type=LLMErrorType.RATE_LIMIT,
                original_message=str(error),
                status_code=429,
            )
        elif "quota" in error_msg or "insufficient_quota" in error_msg:
            return LLMError(
                error_type=LLMErrorType.QUOTA_EXCEEDED,
                original_message=str(error),
                status_code=429,
            )
        elif "401" in error_msg or "invalid" in error_msg:
            return LLMError(
                error_type=LLMErrorType.API_KEY_INVALID,
                original_message=str(error),
                status_code=401,
            )
        elif "timeout" in error_type or "timeout" in error_msg:
            return LLMError(
                error_type=LLMErrorType.TIMEOUT,
                original_message=str(error),
            )
        elif "model" in error_msg and ("not found" in error_msg or "404" in error_msg):
            return LLMError(
                error_type=LLMErrorType.MODEL_NOT_FOUND,
                original_message=str(error),
                status_code=404,
            )
        elif "context" in error_msg and "length" in error_msg:
            return LLMError(
                error_type=LLMErrorType.CONTEXT_LENGTH,
                original_message=str(error),
                status_code=400,
            )
    except Exception:
        pass
    
    # Default to unknown error type
    return LLMError(
        error_type=LLMErrorType.UNKNOWN,
        original_message=str(error),
    )


def safe_deduplicate_by_field(
    items: List[Dict[str, Any]],
    field_key: str,
    keep_first: bool = True,
) -> List[Dict[str, Any]]:
    """
    Safely deduplicate list of dicts by a specific field, avoiding set() limitations.
    
    Uses dict insertion order (Python 3.7+) to maintain original order.
    
    Args:
        items: List of dictionaries to deduplicate
        field_key: Dictionary key to use for deduplication
        keep_first: If True, keep first occurrence; if False, keep last
    
    Returns:
        List of deduplicated dictionaries preserving order
    
    Example:
        >>> careers = [
        ...     {"role": "Engineer", "salary": 100},
        ...     {"role": "Engineer", "salary": 120},  # Duplicate role
        ...     {"role": "Manager", "salary": 90},
        ... ]
        >>> unique = safe_deduplicate_by_field(careers, "role")
        >>> assert len(unique) == 2
    """
    if not items:
        return []
    
    seen: Set[Any] = set()
    result = []
    
    for item in items:
        if not isinstance(item, dict):
            logger.warning(f"Expected dict, got {type(item).__name__}: {item}")
            continue
        
        field_value = item.get(field_key)
        if field_value is None:
            # Include items missing the field
            result.append(item)
            continue
        
        # Use string representation for hashability
        field_key_str = str(field_value).lower()
        
        if field_key_str not in seen:
            seen.add(field_key_str)
            result.append(item)
        elif not keep_first:
            # Replace previous occurrence
            result = [r for r in result if str(r.get(field_key, "")).lower() != field_key_str]
            result.append(item)
    
    return result


def safe_extract_strings(
    items: List[Any],
    fallback: Optional[List[str]] = None,
) -> List[str]:
    """
    Safely extract strings from mixed-type list, converting non-strings when possible.
    
    Args:
        items: List potentially containing strings, numbers, dicts, etc.
        fallback: Default list to return if extraction fails
    
    Returns:
        List of strings extracted from items
    
    Example:
        >>> mixed = ["Python", 3.5, {"name": "Java"}, "SQL", None]
        >>> result = safe_extract_strings(mixed, fallback=[])
        >>> assert "Python" in result
        >>> assert "SQL" in result
    """
    if not items:
        return fallback or []
    
    result = []
    for item in items:
        try:
            if isinstance(item, str):
                if item.strip():
                    result.append(item.strip())
            elif isinstance(item, dict):
                # Try to extract string representation or 'name'/'skill' field
                if "name" in item:
                    result.append(str(item["name"]).strip())
                elif "skill" in item:
                    result.append(str(item["skill"]).strip())
                elif "role" in item:
                    result.append(str(item["role"]).strip())
                else:
                    logger.debug(f"Cannot extract string from dict: {item}")
            elif isinstance(item, (int, float)):
                result.append(str(item))
            elif item is not None:
                result.append(str(item))
        except Exception as e:
            logger.debug(f"Failed to extract string from {type(item).__name__}: {e}")
    
    return result if result else fallback or []


def safe_combine_lists(
    *lists: List[Any],
    deduplicate: bool = True,
    flatten: bool = True,
) -> List[Any]:
    """
    Safely combine multiple lists, handling None/empty cases and optional deduplication.
    
    Args:
        *lists: Variable number of lists to combine
        deduplicate: If True, remove duplicates (for hashable items)
        flatten: If True, flatten nested lists
    
    Returns:
        Combined list, optionally deduplicated and flattened
    
    Example:
        >>> result = safe_combine_lists([1, 2], [2, 3], None, deduplicate=True)
        >>> assert result == [1, 2, 3]
    """
    result = []
    
    for lst in lists:
        if lst is None:
            continue
        if not isinstance(lst, (list, tuple)):
            logger.warning(f"Expected list/tuple, got {type(lst).__name__}")
            continue
        
        if flatten:
            for item in lst:
                if isinstance(item, (list, tuple)):
                    result.extend(item)
                else:
                    result.append(item)
        else:
            result.extend(lst)
    
    if deduplicate:
        try:
            # Try normal set deduplication for hashable items
            return list(dict.fromkeys(result))  # Preserves order
        except TypeError:
            # If items aren't hashable, return as-is
            logger.debug("Cannot deduplicate unhashable items, returning with duplicates")
            return result
    
    return result


def safe_parse_json(
    text: str,
    fallback: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Safely parse JSON text with fallback for malformed input.
    
    Args:
        text: JSON string to parse
        fallback: Default dict to return if parsing fails
    
    Returns:
        Parsed JSON dict or fallback dict
    
    Example:
        >>> result = safe_parse_json('{"role": "Engineer"}')
        >>> assert result["role"] == "Engineer"
        >>> result = safe_parse_json("invalid", fallback={"error": True})
        >>> assert result["error"] == True
    """
    if not text or not isinstance(text, str):
        return fallback or {}
    
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error: {e}. Using fallback.")
        return fallback or {}
    except Exception as e:
        logger.error(f"Unexpected error parsing JSON: {e}")
        return fallback or {}


def validate_output_structure(
    data: Dict[str, Any],
    required_fields: List[str],
    field_types: Optional[Dict[str, type]] = None,
) -> bool:
    """
    Validate that output data matches expected structure.
    
    Args:
        data: Dictionary to validate
        required_fields: List of required field names
        field_types: Optional dict mapping field names to expected types
    
    Returns:
        True if valid, False otherwise
    
    Example:
        >>> data = {"role": "Engineer", "confidence": 0.9}
        >>> is_valid = validate_output_structure(
        ...     data=data,
        ...     required_fields=["role"],
        ...     field_types={"confidence": float}
        ... )
        >>> assert is_valid
    """
    if not isinstance(data, dict):
        logger.warning(f"Expected dict, got {type(data).__name__}")
        return False
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            logger.warning(f"Missing required field: {field}")
            return False
    
    # Check field types if provided
    if field_types:
        for field, expected_type in field_types.items():
            if field in data and not isinstance(data[field], expected_type):
                logger.warning(
                    f"Field {field} has wrong type: {type(data[field]).__name__}, "
                    f"expected {expected_type.__name__}"
                )
                return False
    
    return True


def create_fallback_career_recommendation(
    role: str = "Backend Engineer",
    confidence: float = 0.5,
    reason: str = "Generated from template due to LLM error",
) -> Dict[str, Any]:
    """
    Create a minimal valid career recommendation fallback.
    
    Args:
        role: Career role name
        confidence: Confidence score 0-1
        reason: Explanation for fallback
    
    Returns:
        Valid career recommendation dict
    """
    return {
        "role": role,
        "confidence": min(max(confidence, 0.0), 1.0),
        "required_skills": ["Python", "Problem Solving"],
        "reasoning": reason,
    }


def create_fallback_gap_analysis(
    current_skills: List[str],
    required_skills: List[str],
    target_role: str = "Target Role",
) -> Dict[str, Any]:
    """
    Create a minimal valid gap analysis fallback.
    
    Args:
        current_skills: List of user's current skills
        required_skills: List of required skills
        target_role: Target career role
    
    Returns:
        Valid gap analysis dict
    """
    gaps = [s for s in required_skills if s.lower() not in [c.lower() for c in current_skills]]
    
    return {
        "success": True,
        "target_role": target_role,
        "current_skills": current_skills,
        "required_skills": required_skills,
        "gap_analysis": gaps,
        "priority_gaps": gaps[:3],
        "timeline_months": 6,
        "recommendations": [f"Learn {skill}" for skill in gaps[:2]],
        "note": "Generated from template due to LLM error",
    }


def create_fallback_roadmap(
    target_role: str,
    missing_skills: List[str],
    experience_level: str = "mid",
) -> Dict[str, Any]:
    """
    Create a minimal valid learning roadmap fallback.
    
    Args:
        target_role: Target career role
        missing_skills: List of skills to learn
        experience_level: Current experience level
    
    Returns:
        Valid roadmap dict
    """
    # Divide missing_skills into phases
    phase_size = max(1, len(missing_skills) // 3)
    
    phases = []
    for i in range(3):
        start = i * phase_size
        end = (i + 1) * phase_size if i < 2 else len(missing_skills)
        phase_skills = missing_skills[start:end]
        
        if phase_skills:
            phases.append({
                "phase": i + 1,
                "title": ["Foundation", "Intermediate", "Advanced"][i],
                "duration_months": 2 + i,
                "skills": phase_skills,
                "resources": ["Udemy", "Official Documentation"],
            })
    
    return {
        "success": True,
        "target_role": target_role,
        "phases": phases,
        "total_months": sum(p.get("duration_months", 0) for p in phases),
        "resources": ["Udemy", "Coursera", "Official Documentation"],
        "milestones": [f"Phase {i+1} complete" for i in range(len(phases))],
        "note": "Generated from template due to LLM error",
    }
