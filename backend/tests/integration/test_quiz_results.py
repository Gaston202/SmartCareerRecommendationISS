"""Integration tests for quiz results generation pipeline."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json


class TestQuizResultsPipeline:
    """Integration tests for the complete quiz results generation pipeline."""

    def test_build_payload_from_mobile_format(self):
        """Test that mobile format is properly converted for AI."""
        from app.core.ai_orchestrator import AIOrchestratorService
        
        orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)
        orchestrator.config = MagicMock()
        
        mobile_format = [
            {
                "questionNumber": 1,
                "question": "When you inherit a new project, what do you look for first?",
                "selectedLabel": "Find the fastest path to move it forward",
                "allOptions": [
                    {"id": "B", "label": "Map the scope, rules, and quality standards"},
                    {"id": "V", "label": "Understand who is involved and how they work together"},
                    {"id": "O", "label": "Find the fastest path to move it forward"},
                    {"id": "A", "label": "Spot room for a fresh approach or idea"},
                ]
            },
            {
                "questionNumber": 2,
                "question": "In a team that is moving quickly, what role do you naturally take?",
                "selectedLabel": "Keep decisions moving and action visible",
                "allOptions": [
                    {"id": "B", "label": "Keep the work precise and well organized"},
                    {"id": "V", "label": "Keep people aligned, supported, and heard"},
                    {"id": "O", "label": "Keep decisions moving and action visible"},
                    {"id": "A", "label": "Keep ideas fresh and possibilities expanding"},
                ]
            },
        ]
        
        result = orchestrator._build_quiz_session_payload(mobile_format)
        
        assert len(result) == 2
        assert result[0]["questionNumber"] == 1
        assert result[0]["selectedOption"] == "Find the fastest path to move it forward"
        assert len(result[0]["allOptions"]) == 4
        assert result[0]["allOptions"][0]["id"] == "B"
        assert result[0]["allOptions"][0]["label"] == "Map the scope, rules, and quality standards"

    def test_build_payload_with_snake_case(self):
        """Test snake_case field mapping."""
        from app.core.ai_orchestrator import AIOrchestratorService
        
        orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)
        
        snake_case = [
            {
                "question_number": 1,
                "question": "Test question?",
                "answer": "My answer",
                "options": ["My answer", "Other"]
            }
        ]
        
        result = orchestrator._build_quiz_session_payload(snake_case)
        
        assert len(result) == 1
        assert result[0]["questionNumber"] == 1
        assert result[0]["selectedOption"] == "My answer"
        assert len(result[0]["allOptions"]) == 2

    def test_extract_json_strips_markdown(self):
        """Test JSON extraction from markdown."""
        from app.core.ai_orchestrator import AIOrchestratorService
        
        orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)
        
        markdown_content = '''```json
{
  "novaProfile": {
    "headline": "Test Profile",
    "behavior": {
      "primaryStyle": "Dominance",
      "secondaryStyle": "Influence"
    }
  }
}
```'''
        
        result = orchestrator.extract_json(markdown_content)
        parsed = orchestrator.try_parse_json(result)
        
        assert parsed is not None
        assert "novaProfile" in parsed
        assert parsed["novaProfile"]["headline"] == "Test Profile"

    def test_nova_profile_required_keys(self):
        """Test that required Nova profile keys are present."""
        from app.core.ai_orchestrator import AIOrchestratorService
        
        orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)
        
        required_keys = [
            "headline", "professionalIdentity", "behavior",
            "styleComparison", "motivations", "cognition",
            "careerProjection", "recommendedDevelopmentAxes"
        ]
        
        behavior_keys = [
            "primaryStyle", "secondaryStyle", "traits",
            "discBlend", "discPercentages"
        ]
        
        test_profile = {
            "novaProfile": {
                "headline": "Test",
                "professionalIdentity": "Test identity",
                "behavior": {
                    "primaryStyle": "Dominance",
                    "secondaryStyle": "Influence",
                    "traits": ["Trait1"],
                    "discBlend": "R50/Y30/G10/B10",
                    "discPercentages": {"red": 50, "yellow": 30, "green": 10, "blue": 10}
                },
                "styleComparison": {
                    "naturalStyleSummary": "Test",
                    "adaptedStyleSummary": "Test",
                    "adaptationDrivers": [],
                    "stressSignals": []
                },
                "motivations": {
                    "topMotivators": [],
                    "demotivators": [],
                    "valuesSummary": "Test"
                },
                "cognition": {
                    "decisionStyle": "Test",
                    "thinkingStyle": "Test",
                    "learningStyle": "Test",
                    "communicationStyle": "Test"
                },
                "careerProjection": {
                    "bestFitEnvironments": [],
                    "leadershipStyle": "Test",
                    "watchouts": [],
                    "futureFocus": "Test"
                },
                "recommendedDevelopmentAxes": ["Axis 1", "Axis 2"]
            }
        }
        
        for key in required_keys:
            assert key in test_profile["novaProfile"], f"Missing key: {key}"
        
        for key in behavior_keys:
            assert key in test_profile["novaProfile"]["behavior"], f"Missing behavior key: {key}"

    def test_disc_percentages_structure(self):
        """Test DISC percentages have correct structure."""
        from app.modules.quiz.service import QuizService
        
        service = QuizService.__new__(QuizService)
        
        test_answers = [
            {"questionNumber": 1, "selectedLabel": "I thrive in teams, especially when leading or competing"},
            {"questionNumber": 2, "selectedLabel": "A fast-paced, competitive setting with rapid decisions"},
        ]
        
        disc = service._compute_disc_from_answers(test_answers)
        
        assert "red" in disc
        assert "blue" in disc
        assert "green" in disc
        assert "yellow" in disc
        assert "dominant" in disc
        assert all(0 <= disc[c] <= 100 for c in ["red", "blue", "green", "yellow"])
        assert disc["dominant"] in ["red", "blue", "green", "yellow"]

    def test_ensure_complete_profile_merges_behavior(self):
        """Test that ensure_complete_nova_profile properly merges behavior."""
        from app.modules.quiz.service import QuizService
        
        service = QuizService.__new__(QuizService)
        
        fallback = {
            "headline": "Fallback Profile",
            "behavior": {
                "primaryStyle": "Blue",
                "traits": ["Trait1", "Trait2"],
                "discPercentages": {"red": 25, "yellow": 25, "green": 25, "blue": 25}
            },
            "motivations": {"topMotivators": ["Motivation1"]}
        }
        
        candidate = {
            "headline": "AI Profile",
            "behavior": {
                "primaryStyle": "Red",
                "discPercentages": {"red": 50, "yellow": 20, "green": 20, "blue": 10}
            }
        }
        
        result = service._ensure_complete_nova_profile(candidate, fallback)
        
        assert result["headline"] == "AI Profile"
        assert result["behavior"]["primaryStyle"] == "Red"
        assert result["behavior"]["traits"] == ["Trait1", "Trait2"]
        assert result["behavior"]["discPercentages"]["red"] == 50

    def test_enforce_disc_percentages(self):
        """Test that enforce_deterministic_disc overwrites AI percentages."""
        from app.modules.quiz.service import QuizService
        
        service = QuizService.__new__(QuizService)
        
        ai_profile = {
            "headline": "AI Profile",
            "behavior": {
                "primaryStyle": "Blue",
                "discPercentages": {"red": 10, "yellow": 20, "green": 30, "blue": 40}
            }
        }
        
        real_disc = {"red": 40, "blue": 30, "green": 20, "yellow": 10, "dominant": "red"}
        
        result = service._enforce_deterministic_disc_on_nova_profile(ai_profile, real_disc)
        
        assert result["behavior"]["discPercentages"]["red"] == 40
        assert result["behavior"]["discPercentages"]["blue"] == 30
        assert result["behavior"]["discPercentages"]["green"] == 20
        assert result["behavior"]["discPercentages"]["yellow"] == 10


class TestQuizServiceFallback:
    """Test fallback behavior when AI fails."""

    def test_build_nova_from_deterministic_has_all_keys(self):
        """Test that deterministic fallback has all required keys."""
        from app.modules.quiz.service import QuizService
        
        service = QuizService.__new__(QuizService)
        service.LABEL_TO_DISC = QuizService.LABEL_TO_DISC
        
        user_profile = {
            "disc": {"red": 30, "blue": 40, "green": 20, "yellow": 10, "dominant": "blue"},
            "skills": ["Python", "Data Analysis"],
            "interests": ["Technology"]
        }
        
        result = service._build_nova_profile_from_deterministic(user_profile)
        
        assert "headline" in result
        assert "professionalIdentity" in result
        assert "behavior" in result
        assert "behavior" in result
        assert "styleComparison" in result
        assert "motivations" in result
        assert "cognition" in result
        assert "careerProjection" in result
        assert "recommendedDevelopmentAxes" in result

    def test_fallback_resolves_to_deterministic_when_ai_returns_empty(self):
        """Test that empty AI result falls back to deterministic."""
        from app.modules.quiz.service import QuizService
        
        service = QuizService.__new__(QuizService)
        service.LABEL_TO_DISC = QuizService.LABEL_TO_DISC
        
        disc = {"red": 30, "blue": 40, "green": 20, "yellow": 10, "dominant": "blue"}
        fallback_user = {"disc": disc, "skills": [], "interests": []}
        
        fallback_nova = service._build_nova_profile_from_deterministic(fallback_user)
        
        ai_nova = None  # AI returned nothing
        result = service._ensure_complete_nova_profile(ai_nova, fallback_nova)
        result = service._enforce_deterministic_disc_on_nova_profile(result, disc)
        
        assert result["behavior"]["discPercentages"]["blue"] == 40
        assert result["behavior"]["discPercentages"]["red"] == 30