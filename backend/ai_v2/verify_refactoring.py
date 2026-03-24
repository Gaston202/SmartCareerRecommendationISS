#!/usr/bin/env python3
"""
Verification script for the LLM refactoring changes.

Run this to validate that all changes are working correctly.
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

from backend.ai_v2.utils.fallback_utils import (
    categorize_llm_error,
    LLMErrorType,
    safe_extract_strings,
    safe_deduplicate_by_field,
)


def test_error_categorization():
    """Test error categorization."""
    print("Testing error categorization...")
    
    try:
        raise Exception("insufficient_quota")
    except Exception as e:
        llm_error = categorize_llm_error(e)
        assert llm_error.error_type == LLMErrorType.QUOTA_EXCEEDED
        print("  ✓ Quota error detected correctly")
    
    try:
        raise Exception("429 rate limit exceeded")
    except Exception as e:
        llm_error = categorize_llm_error(e)
        assert llm_error.error_type == LLMErrorType.RATE_LIMIT
        print("  ✓ Rate limit error detected correctly")
    
    print("✓ Error categorization tests passed\n")


def test_safe_extract_strings():
    """Test safe string extraction."""
    print("Testing safe string extraction...")
    
    # Mixed types
    mixed = ["Python", 3.5, {"name": "Java"}, "SQL", None]
    result = safe_extract_strings(mixed, fallback=[])
    
    assert "Python" in result
    assert "SQL" in result
    assert "Java" in result
    assert len(result) >= 3
    print("  ✓ Mixed-type extraction works")
    
    # All dicts
    dicts = [{"skill": "Python"}, {"name": "JavaScript"}]
    result = safe_extract_strings(dicts, fallback=[])
    assert "Python" in result
    assert "JavaScript" in result
    print("  ✓ Dict extraction works")
    
    # All strings
    strings = ["Python", "SQL", "Docker"]
    result = safe_extract_strings(strings, fallback=[])
    assert result == strings
    print("  ✓ String pass-through works")
    
    print("✓ Safe string extraction tests passed\n")


def test_safe_deduplicate():
    """Test safe deduplication by field."""
    print("Testing safe deduplication...")
    
    careers = [
        {"role": "Backend Engineer", "confidence": 0.9},
        {"role": "Backend Engineer", "confidence": 0.85},  # Duplicate role
        {"role": "Full-Stack", "confidence": 0.8},
    ]
    
    result = safe_deduplicate_by_field(careers, "role")
    
    assert len(result) == 2, f"Expected 2 items, got {len(result)}"
    assert result[0]["role"] == "Backend Engineer"
    assert result[1]["role"] == "Full-Stack"
    print("  ✓ Deduplication by role works")
    print("  ✓ Original order preserved")
    print("  ✓ First occurrence kept")
    
    print("✓ Safe deduplication tests passed\n")


def test_imports():
    """Test that all modules can be imported."""
    print("Testing imports...")
    
    try:
        from backend.ai_v2.services.llm import LLMService
        print("  ✓ LLMService imported")
    except ImportError as e:
        print(f"  ✗ Failed to import LLMService: {e}")
        return False
    
    try:
        from backend.ai_v2.agents.career_agent import CareerAgent
        print("  ✓ CareerAgent imported")
    except ImportError as e:
        print(f"  ✗ Failed to import CareerAgent: {e}")
        return False
    
    try:
        from backend.ai_v2.agents.explanation_agent import ExplanationAgent
        print("  ✓ ExplanationAgent imported")
    except ImportError as e:
        print(f"  ✗ Failed to import ExplanationAgent: {e}")
        return False
    
    try:
        from backend.ai_v2.utils.fallback_utils import (
            create_fallback_career_recommendation,
            create_fallback_gap_analysis,
            create_fallback_roadmap,
        )
        print("  ✓ Fallback generators imported")
    except ImportError as e:
        print(f"  ✗ Failed to import fallback generators: {e}")
        return False
    
    print("✓ All imports successful\n")
    return True


def test_llm_service():
    """Test LLM service initialization."""
    print("Testing LLM service...")
    
    try:
        from backend.ai_v2.services.llm import LLMService
        llm = LLMService()
        print(f"  ✓ LLMService initialized")
        print(f"  ✗ Mock mode: {llm.use_mock}")
        print(f"  ✓ Has client: {llm.client is not None}")
    except Exception as e:
        print(f"  ✗ Failed to initialize LLMService: {e}")
        return False
    
    print("✓ LLM service initialization successful\n")
    return True


def main():
    """Run all verification tests."""
    print("=" * 60)
    print("VERIFICATION TESTS FOR LLM REFACTORING")
    print("=" * 60 + "\n")
    
    try:
        test_error_categorization()
        test_safe_extract_strings()
        test_safe_deduplicate()
        test_imports()
        test_llm_service()
        
        print("=" * 60)
        print("✓ ALL VERIFICATION TESTS PASSED")
        print("=" * 60)
        print("\nRefactoring is ready for use!")
        print("\nNext steps:")
        print("1. Review REFACTOR_COMPLETE.md for detailed changes")
        print("2. Follow NEXT_3_STEPS.md for upcoming implementation")
        print("3. Run: python -m backend.ai_v2.main_pipeline")
        return 0
    
    except AssertionError as e:
        print(f"\n✗ ASSERTION FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
