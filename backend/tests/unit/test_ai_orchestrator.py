import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.ai_orchestrator import AIOrchestratorService


class TestBuildQuizSessionPayload:
    """Tests for _build_quiz_session_payload method."""

    def setup_method(self):
        self.orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)
        self.orchestrator.config = MagicMock()
        self.orchestrator.config.get_models = MagicMock(return_value=["test/model"])

    def test_empty_session(self):
        result = self.orchestrator._build_quiz_session_payload([])
        assert result == []

    def test_none_session(self):
        result = self.orchestrator._build_quiz_session_payload(None)
        assert result == []

    def test_valid_session_with_label_options(self):
        session = [{
            "questionNumber": 1,
            "question": "Test question?",
            "selectedLabel": "Option A",
            "allOptions": [
                {"id": "A", "label": "Option A"},
                {"id": "B", "label": "Option B"},
            ]
        }]
        result = self.orchestrator._build_quiz_session_payload(session)
        assert len(result) == 1
        assert result[0]["questionNumber"] == 1
        assert result[0]["selectedOption"] == "Option A"
        assert len(result[0]["allOptions"]) == 2
        assert result[0]["allOptions"][0]["label"] == "Option A"

    def test_valid_session_with_string_options(self):
        session = [{
            "questionNumber": 2,
            "question": "Another question?",
            "selectedOption": "First",
            "options": ["First", "Second", "Third"]
        }]
        result = self.orchestrator._build_quiz_session_payload(session)
        assert len(result) == 1
        assert result[0]["selectedOption"] == "First"
        assert len(result[0]["allOptions"]) == 3
        assert result[0]["allOptions"][0]["label"] == "First"

    def test_valid_session_with_snake_case(self):
        session = [{
            "question_number": 3,
            "question": "Snake case question?",
            "answer": "Selected answer",
            "options": [{"id": "X", "label": "Selected answer"}]
        }]
        result = self.orchestrator._build_quiz_session_payload(session)
        assert len(result) == 1
        assert result[0]["questionNumber"] == 3
        assert result[0]["selectedOption"] == "Selected answer"

    def test_multiple_questions(self):
        session = [
            {"questionNumber": 1, "question": "Q1?", "selectedLabel": "A1", "allOptions": []},
            {"questionNumber": 2, "question": "Q2?", "selectedLabel": "A2", "allOptions": []},
            {"questionNumber": 3, "question": "Q3?", "selectedLabel": "A3", "allOptions": []},
        ]
        result = self.orchestrator._build_quiz_session_payload(session)
        assert len(result) == 3
        assert result[0]["questionNumber"] == 1
        assert result[1]["questionNumber"] == 2
        assert result[2]["questionNumber"] == 3

    def test_filters_non_dict_items(self):
        session = [
            {"questionNumber": 1, "question": "Q1?", "selectedLabel": "A1", "allOptions": []},
            None,
            "invalid",
            {"questionNumber": 2, "question": "Q2?", "selectedLabel": "A2", "allOptions": []},
        ]
        result = self.orchestrator._build_quiz_session_payload(session)
        assert len(result) == 2


class TestExtractJson:
    """Tests for extract_json method."""

    def setup_method(self):
        self.orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)

    def test_strips_json_code_fence(self):
        content = '```json\n{"key": "value"}\n```'
        result = self.orchestrator.extract_json(content)
        assert result == '{"key": "value"}'

    def test_strips_regular_code_fence(self):
        content = '```\n{"key": "value"}\n```'
        result = self.orchestrator.extract_json(content)
        assert result == '{"key": "value"}'

    def test_extracts_json_from_mixed_content(self):
        content = 'Some text before\n{"key": "value"}\nSome text after'
        result = self.orchestrator.extract_json(content)
        assert result == '{"key": "value"}'

    def test_handles_empty_content(self):
        result = self.orchestrator.extract_json("")
        assert result == "{}"

    def test_handles_none_content(self):
        result = self.orchestrator.extract_json(None)
        assert result == "{}"


class TestTryParseJson:
    """Tests for try_parse_json method."""

    def setup_method(self):
        self.orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)

    def test_parses_valid_json(self):
        content = '{"key": "value", "number": 42}'
        result = self.orchestrator.try_parse_json(content)
        assert result == {"key": "value", "number": 42}

    def test_handles_invalid_json(self):
        result = self.orchestrator.try_parse_json("not valid json")
        assert result is None

    def test_handles_empty_content(self):
        result = self.orchestrator.try_parse_json("")
        assert result is None

    def test_handles_minimum_length_content(self):
        result = self.orchestrator.try_parse_json('{"key": "value"}')  # 17 chars > 10
        assert result is not None

    def test_handles_partial_json(self):
        content = '{"key": "value", "nested": {"inner":'
        result = self.orchestrator.try_parse_json(content)
        assert result is None


class TestValidateResponse:
    """Tests for _validate_response method."""

    def setup_method(self):
        self.orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)

    def test_valid_response(self):
        response = {
            "choices": [{
                "message": {"content": "Some text"}
            }]
        }
        assert self.orchestrator._validate_response(response) is True

    def test_empty_content(self):
        response = {
            "choices": [{
                "message": {"content": ""}
            }]
        }
        assert self.orchestrator._validate_response(response) is False

    def test_missing_choices(self):
        response = {"data": []}
        assert self.orchestrator._validate_response(response) is False

    def test_missing_message(self):
        response = {"choices": [{}]}
        assert self.orchestrator._validate_response(response) is False

    def test_missing_content(self):
        response = {"choices": [{"message": {}}]}
        assert self.orchestrator._validate_response(response) is False

    def test_list_content_coerced(self):
        response = {
            "choices": [{
                "message": {"content": ["item1", "item2"]}
            }]
        }
        assert self.orchestrator._validate_response(response) is True


class TestCoerceContentToText:
    """Tests for _coerce_content_to_text method."""

    def setup_method(self):
        self.orchestrator = AIOrchestratorService.__new__(AIOrchestratorService)

    def test_string_passthrough(self):
        content = "Hello, world!"
        result = self.orchestrator._coerce_content_to_text(content)
        assert result == "Hello, world!"

    def test_list_to_string(self):
        content = ["Hello", "World"]
        result = self.orchestrator._coerce_content_to_text(content)
        assert result == "Hello\nWorld"

    def test_dict_to_string(self):
        content = {"key": "value"}
        result = self.orchestrator._coerce_content_to_text(content)
        assert "key" in result

    def test_none_returns_empty(self):
        result = self.orchestrator._coerce_content_to_text(None)
        assert result == ""