import pytest
from unittest.mock import AsyncMock, MagicMock
from app.modules.quiz.service import QuizService


class TestComputeDiscFromAnswers:
    """Tests for _compute_disc_from_answers method."""

    def setup_method(self):
        self.service = QuizService.__new__(QuizService)
        self.service.LABEL_TO_DISC = QuizService.LABEL_TO_DISC

    def test_calculates_red_dominant(self):
        answers = [
            {"questionNumber": 1, "selectedLabel": "I thrive in teams, especially when leading or competing"},
            {"questionNumber": 2, "selectedLabel": "A fast-paced, competitive setting with rapid decisions"},
            {"questionNumber": 3, "selectedLabel": "Action problems: quick decisions, crisis management, obstacles to overcome"},
            {"questionNumber": 4, "selectedLabel": "Somewhat important; helping others should align with achieving results"},
            {"questionNumber": 5, "selectedLabel": "I want freedom to make decisions and chart my own course"},
        ]
        disc = self.service._compute_disc_from_answers(answers)
        assert "red" in disc
        assert "blue" in disc
        assert "green" in disc
        assert "yellow" in disc
        assert "dominant" in disc
        assert all(0 <= disc[c] <= 100 for c in ["red", "blue", "green", "yellow"])

    def test_calculates_blue_dominant(self):
        answers = [
            {"questionNumber": 1, "selectedLabel": "I do my best work alone, focused and self-directed"},
            {"questionNumber": 2, "selectedLabel": "A quiet, structured office with clear processes"},
            {"questionNumber": 3, "selectedLabel": "Complex analytical problems that require research and data"},
        ]
        disc = self.service._compute_disc_from_answers(answers)
        assert disc["dominant"] in ["red", "blue", "green", "yellow"]

    def test_handles_empty_answers(self):
        disc = self.service._compute_disc_from_answers([])
        assert "red" in disc
        assert disc["red"] == 0

    def test_handles_missing_label(self):
        answers = [{"questionNumber": 1, "selectedLabel": ""}]
        disc = self.service._compute_disc_from_answers(answers)
        assert "red" in disc


class TestBuildNovaProfileFromDeterministic:
    """Tests for _build_nova_profile_from_deterministic method."""

    def setup_method(self):
        self.service = QuizService.__new__(QuizService)
        self.service.LABEL_TO_DISC = QuizService.LABEL_TO_DISC

    def test_returns_required_structure(self):
        user_profile = {
            "disc": {"red": 30, "blue": 40, "green": 20, "yellow": 10, "dominant": "blue"},
            "skills": ["Python", "Data Analysis"],
            "interests": ["Technology", "Innovation"],
        }
        nova = self.service._build_nova_profile_from_deterministic(user_profile)
        
        assert "headline" in nova
        assert "professionalIdentity" in nova
        assert "behavior" in nova
        assert "styleComparison" in nova
        assert "motivations" in nova
        assert "cognition" in nova
        assert "careerProjection" in nova
        assert "recommendedDevelopmentAxes" in nova

    def test_behavior_has_required_fields(self):
        user_profile = {
            "disc": {"red": 25, "blue": 25, "green": 25, "yellow": 25, "dominant": "blue"},
            "skills": [],
            "interests": [],
        }
        nova = self.service._build_nova_profile_from_deterministic(user_profile)
        behavior = nova["behavior"]
        
        assert "primaryStyle" in behavior
        assert "traits" in behavior
        assert "discBlend" in behavior
        assert "discPercentages" in behavior
        assert "red" in behavior["discPercentages"]
        assert "yellow" in behavior["discPercentages"]
        assert "green" in behavior["discPercentages"]
        assert "blue" in behavior["discPercentages"]

    def test_handles_default_disc(self):
        user_profile = {"disc": {}, "skills": [], "interests": []}
        nova = self.service._build_nova_profile_from_deterministic(user_profile)
        assert nova["behavior"]["discPercentages"]["blue"] == 25


class TestEnsureCompleteNovaProfile:
    """Tests for _ensure_complete_nova_profile method."""

    def setup_method(self):
        self.service = QuizService.__new__(QuizService)

    def test_returns_fallback_when_candidate_empty(self):
        fallback = {"headline": "Fallback", "behavior": {"primary": "blue"}}
        result = self.service._ensure_complete_nova_profile({}, fallback)
        assert result["headline"] == "Fallback"

    def test_prefers_candidate_values(self):
        fallback = {"headline": "Fallback", "behavior": {"primary": "blue"}}
        candidate = {"headline": "Candidate", "behavior": {"primary": "red"}}
        result = self.service._ensure_complete_nova_profile(candidate, fallback)
        assert result["headline"] == "Candidate"

    def test_merges_behavior_deeply(self):
        fallback = {
            "behavior": {
                "primaryStyle": "blue",
                "traits": ["analytical"],
                "discPercentages": {"red": 25, "blue": 25}
            }
        }
        candidate = {
            "behavior": {
                "primaryStyle": "red",
                "discPercentages": {"red": 50, "blue": 10}
            }
        }
        result = self.service._ensure_complete_nova_profile(candidate, fallback)
        assert result["behavior"]["primaryStyle"] == "red"
        assert result["behavior"]["traits"] == ["analytical"]
        assert result["behavior"]["discPercentages"]["red"] == 50

    def test_handles_none_candidate(self):
        fallback = {"headline": "Fallback"}
        result = self.service._ensure_complete_nova_profile(None, fallback)
        assert result["headline"] == "Fallback"


class TestEnforceDeterministicDisc:
    """Tests for _enforce_deterministic_disc_on_nova_profile method."""

    def setup_method(self):
        self.service = QuizService.__new__(QuizService)

    def test_enforces_disc_percentages(self):
        nova_profile = {
            "behavior": {
                "primaryStyle": "blue",
                "discPercentages": {"red": 10, "blue": 90}
            }
        }
        disc = {"red": 50, "blue": 20, "green": 20, "yellow": 10}
        result = self.service._enforce_deterministic_disc_on_nova_profile(nova_profile, disc)
        assert result["behavior"]["discPercentages"]["red"] == 50
        assert result["behavior"]["discPercentages"]["blue"] == 20

    def test_adds_primary_style_if_missing(self):
        nova_profile = {"behavior": {}}
        disc = {"dominant": "green"}
        result = self.service._enforce_deterministic_disc_on_nova_profile(nova_profile, disc)
        assert "primaryStyle" in result["behavior"]

    def test_handles_empty_profile(self):
        nova_profile = {}
        disc = {"red": 25, "blue": 25, "green": 25, "yellow": 25, "dominant": "blue"}
        result = self.service._enforce_deterministic_disc_on_nova_profile(nova_profile, disc)
        assert "behavior" in result


class TestInferBestEnvironments:
    """Tests for _infer_best_environments method."""

    def setup_method(self):
        self.service = QuizService.__new__(QuizService)

    def test_green_high_adds_collaborative(self):
        disc = {"green": 40, "blue": 20, "red": 20, "yellow": 20}
        envs = self.service._infer_best_environments(disc, {})
        assert any("Collaborative" in e for e in envs)

    def test_blue_high_adds_structured(self):
        disc = {"green": 20, "blue": 40, "red": 20, "yellow": 20}
        envs = self.service._infer_best_environments(disc, {})
        assert any("Structured" in e for e in envs)

    def test_red_high_adds_fast_paced(self):
        disc = {"green": 20, "blue": 20, "red": 40, "yellow": 20}
        envs = self.service._infer_best_environments(disc, {})
        assert any("fast-paced" in e.lower() for e in envs)

    def test_yellow_high_adds_flexible(self):
        disc = {"green": 20, "blue": 20, "red": 20, "yellow": 40}
        envs = self.service._infer_best_environments(disc, {})
        assert any("flexible" in e.lower() for e in envs)

    def test_all_low_returns_versatile(self):
        disc = {"green": 20, "blue": 20, "red": 20, "yellow": 20}
        envs = self.service._infer_best_environments(disc, {})
        assert any("Versatile" in e for e in envs)


class TestGetPrimaryStyleLabel:
    """Tests for _get_primary_style_label method."""

    def setup_method(self):
        self.service = QuizService.__new__(QuizService)

    def test_red_returns_dominance(self):
        assert "Dominance" in self.service._get_primary_style_label("red")

    def test_blue_returns_conscientiousness(self):
        assert "Conscientiousness" in self.service._get_primary_style_label("blue")

    def test_green_returns_steadiness(self):
        assert "Steadiness" in self.service._get_primary_style_label("green")

    def test_yellow_returns_influence(self):
        assert "Influence" in self.service._get_primary_style_label("yellow")

    def test_unknown_returns_balanced(self):
        assert self.service._get_primary_style_label("unknown") == "Balanced"