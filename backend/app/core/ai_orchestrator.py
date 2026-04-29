"""AI orchestrator - full service for LLM operations with Prompt Anatomy."""
import json
import logging
import asyncio
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx
from app.core.ai.config import AIConfig
from app.core.ai.client import OpenRouterClient
from app.core.config import settings

logger = logging.getLogger(__name__)


NOVA_QUIZ_BLUEPRINTS: List[Dict[str, Any]] = [
    {
        "question": "When you inherit a new project, what do you look for first?",
        "focus": "orientation and structure",
        "intent": "measures whether the user prefers clarity, collaboration, speed, or exploration when starting work",
        "options": [
            {"id": "B", "label": "Map the scope, rules, and quality standards", "icon": "analytics"},
            {"id": "V", "label": "Understand who is involved and how they work together", "icon": "people"},
            {"id": "O", "label": "Find the fastest path to move it forward", "icon": "flash"},
            {"id": "A", "label": "Spot room for a fresh approach or idea", "icon": "globe"},
        ],
    },
    {
        "question": "In a team that is moving quickly, what role do you naturally take?",
        "focus": "relational intelligence",
        "intent": "measures how the user contributes to group momentum and interpersonal balance",
        "options": [
            {"id": "B", "label": "Keep the work precise and well organized", "icon": "analytics"},
            {"id": "V", "label": "Keep people aligned, supported, and heard", "icon": "people"},
            {"id": "O", "label": "Keep decisions moving and action visible", "icon": "flash"},
            {"id": "A", "label": "Keep ideas fresh and possibilities expanding", "icon": "globe"},
        ],
    },
    {
        "question": "When a decision affects others on the team, what do you weigh most?",
        "focus": "decision making",
        "intent": "measures the balance between facts, relationships, speed, and intuition",
        "options": [
            {"id": "B", "label": "Evidence, standards, and likely outcomes", "icon": "analytics"},
            {"id": "V", "label": "Impact on morale, trust, and collaboration", "icon": "people"},
            {"id": "O", "label": "Speed, ownership, and clear execution", "icon": "flash"},
            {"id": "A", "label": "New angles, patterns, and future possibilities", "icon": "globe"},
        ],
    },
    {
        "question": "What kind of work reward feels most meaningful to you?",
        "focus": "motivation",
        "intent": "measures the primary driver behind satisfaction and engagement",
        "options": [
            {"id": "B", "label": "Mastering something and doing it accurately", "icon": "analytics"},
            {"id": "V", "label": "Feeling useful to people and the group", "icon": "people"},
            {"id": "O", "label": "Winning visible results and reaching targets", "icon": "flash"},
            {"id": "A", "label": "Creating something original and adaptable", "icon": "globe"},
        ],
    },
    {
        "question": "How do you prefer to keep other people updated on your work?",
        "focus": "communication style",
        "intent": "measures how the user shares progress, context, and priorities",
        "options": [
            {"id": "B", "label": "With clear facts, notes, and details", "icon": "analytics"},
            {"id": "V", "label": "With warm, collaborative check-ins", "icon": "people"},
            {"id": "O", "label": "With concise updates and decisions", "icon": "flash"},
            {"id": "A", "label": "With big-picture ideas and options", "icon": "globe"},
        ],
    },
    {
        "question": "How do you usually learn something new at work?",
        "focus": "learning preferences",
        "intent": "measures how the user absorbs knowledge and builds competence",
        "options": [
            {"id": "B", "label": "By studying examples and structured steps", "icon": "analytics"},
            {"id": "V", "label": "By discussing it with others and reflecting together", "icon": "people"},
            {"id": "O", "label": "By trying it immediately and adjusting quickly", "icon": "flash"},
            {"id": "A", "label": "By experimenting until the pattern clicks", "icon": "globe"},
        ],
    },
    {
        "question": "Which kind of problem keeps you engaged the longest?",
        "focus": "problem solving",
        "intent": "measures whether the user is drawn to analytical, interpersonal, execution, or creative challenges",
        "options": [
            {"id": "B", "label": "A problem that needs analysis and accuracy", "icon": "analytics"},
            {"id": "V", "label": "A problem involving people, trust, or teamwork", "icon": "people"},
            {"id": "O", "label": "A problem that needs fast action and ownership", "icon": "flash"},
            {"id": "A", "label": "A problem that invites a new concept", "icon": "globe"},
        ],
    },
    {
        "question": "Which work environment helps you stay consistent and energized?",
        "focus": "environment fit",
        "intent": "measures the conditions that help the user thrive over time",
        "options": [
            {"id": "B", "label": "One with clear standards and reliable processes", "icon": "analytics"},
            {"id": "V", "label": "One with supportive people and a steady rhythm", "icon": "people"},
            {"id": "O", "label": "One with pace, autonomy, and visible goals", "icon": "flash"},
            {"id": "A", "label": "One with flexibility, variety, and room to explore", "icon": "globe"},
        ],
    },
    {
        "question": "When perspectives differ, what response feels most natural to you?",
        "focus": "conflict and collaboration",
        "intent": "measures how the user navigates friction while preserving relational intelligence",
        "options": [
            {"id": "B", "label": "Clarify the facts and the criteria", "icon": "analytics"},
            {"id": "V", "label": "Protect the relationship and reduce tension", "icon": "people"},
            {"id": "O", "label": "State the decision and move ahead", "icon": "flash"},
            {"id": "A", "label": "Reframe the problem and open new options", "icon": "globe"},
        ],
    },
    {
        "question": "Which kind of professional identity do you want to build?",
        "focus": "career identity",
        "intent": "measures the long-term pattern of contribution, reputation, and growth",
        "options": [
            {"id": "B", "label": "A trusted expert known for quality", "icon": "analytics"},
            {"id": "V", "label": "A dependable partner people feel safe with", "icon": "people"},
            {"id": "O", "label": "A driver who turns ideas into results", "icon": "flash"},
            {"id": "A", "label": "A creative thinker who brings fresh direction", "icon": "globe"},
        ],
    },
]

# JSON Schema definitions for structured outputs via OpenRouter json_schema format
QUIZ_QUESTION_SCHEMA = {
    "name": "quiz_question",
    "strict": False,
    "schema": {
        "type": "object",
        "properties": {
            "question": {"type": "string"},
            "options": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "label": {"type": "string"},
                        "icon": {"type": "string"},
                    },
                    "required": ["id", "label", "icon"],
                },
            },
            "questionNumber": {"type": "integer"},
        },
        "required": ["question", "options", "questionNumber"],
    },
}

NOVA_PROFILE_SCHEMA = {
    "name": "nova_profile_report",
    "strict": False,
    "schema": {
        "type": "object",
        "properties": {
            "novaProfile": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string"},
                    "professionalIdentity": {"type": "string"},
                    "behavior": {
                        "type": "object",
                        "properties": {
                            "primaryStyle": {"type": ["string", "null"]},
                            "secondaryStyle": {"type": ["string", "null"]},
                            "traits": {"type": "array", "items": {"type": "string"}},
                            "discBlend": {"type": "string"},
                            "discPercentages": {
                                "type": "object",
                                "properties": {
                                    "red": {"type": "integer"},
                                    "yellow": {"type": "integer"},
                                    "green": {"type": "integer"},
                                    "blue": {"type": "integer"},
                                },
                                "required": ["red", "yellow", "green", "blue"],
                            },
                        },
                        "required": ["primaryStyle", "traits", "discBlend", "discPercentages"],
                    },
                    "styleComparison": {
                        "type": "object",
                        "properties": {
                            "naturalStyleSummary": {"type": "string"},
                            "adaptedStyleSummary": {"type": "string"},
                            "adaptationDrivers": {"type": "array", "items": {"type": "string"}},
                            "stressSignals": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["naturalStyleSummary", "adaptedStyleSummary", "adaptationDrivers", "stressSignals"],
                    },
                    "motivations": {
                        "type": "object",
                        "properties": {
                            "topMotivators": {"type": "array", "items": {"type": "string"}},
                            "demotivators": {"type": "array", "items": {"type": "string"}},
                            "valuesSummary": {"type": "string"},
                        },
                        "required": ["topMotivators", "demotivators", "valuesSummary"],
                    },
                    "cognition": {
                        "type": "object",
                        "properties": {
                            "decisionStyle": {"type": "string"},
                            "thinkingStyle": {"type": "string"},
                            "learningStyle": {"type": "string"},
                            "communicationStyle": {"type": "string"},
                        },
                        "required": ["decisionStyle", "thinkingStyle", "learningStyle", "communicationStyle"],
                    },
                    "careerProjection": {
                        "type": "object",
                        "properties": {
                            "bestFitEnvironments": {"type": "array", "items": {"type": "string"}},
                            "leadershipStyle": {"type": "string"},
                            "watchouts": {"type": "array", "items": {"type": "string"}},
                            "futureFocus": {"type": "string"},
                        },
                        "required": ["bestFitEnvironments", "leadershipStyle", "watchouts", "futureFocus"],
                    },
                    "recommendedDevelopmentAxes": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["headline", "professionalIdentity", "behavior", "styleComparison", "motivations", "cognition", "careerProjection", "recommendedDevelopmentAxes"],
            },
        },
        "required": ["novaProfile"],
    },
}

ROADMAP_SCHEMA = {
    "name": "roadmap_personalization",
    "strict": False,
    "schema": {
        "type": "object",
        "properties": {
            "personalizedMilestones": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "duration": {"type": "string"},
                        "skills": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["title", "description", "duration", "skills"],
                },
            },
        },
        "required": ["personalizedMilestones"],
    },
}



class AIOrchestrator:
    """Central AI orchestration service.
    Uses OpenRouter for LLM calls with retry logic.
    """

    def __init__(self):
        self.client = OpenRouterClient()
        self.config = AIConfig()
        self.models = self.config.MODELS

    async def chat_with_retry(
        self,
        task: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1000,
        retries: int = 3,
        response_format: Optional[Dict[str, Any]] = None,
        request_timeout_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Chat with automatic model fallback."""
        models = self.config.get_models(task)
        last_error = None

        logger.info(
            'chat_with_retry: task=%s retries=%s models=%s message_count=%s temperature=%s max_tokens=%s response_format=%s request_timeout_seconds=%s',
            task,
            retries,
            models,
            len(messages),
            temperature,
            max_tokens,
            response_format,
            request_timeout_seconds,
        )

        for attempt in range(retries):
            for model in models:
                try:
                    logger.info(
                        'chat_with_retry: start task=%s attempt=%s/%s model=%s messages=%s',
                        task,
                        attempt + 1,
                        retries,
                        model,
                        len(messages),
                    )
                    start_time = asyncio.get_running_loop().time()
                    response = await self._call(
                        model,
                        messages,
                        temperature,
                        max_tokens,
                        response_format,
                        request_timeout_seconds,
                    )
                    duration = asyncio.get_running_loop().time() - start_time
                    logger.info(
                        'chat_with_retry: end task=%s attempt=%s model=%s duration=%.2fs response_keys=%s',
                        task,
                        attempt + 1,
                        model,
                        duration,
                        list(response.keys()) if isinstance(response, dict) else type(response).__name__,
                    )
                    if self._validate_response(response):
                        logger.info(
                            'chat_with_retry: validated task=%s attempt=%s model=%s',
                            task,
                            attempt + 1,
                            model,
                        )
                        return response
                    logger.warning(
                        'chat_with_retry: invalid response task=%s attempt=%s model=%s response_keys=%s',
                        task,
                        attempt + 1,
                        model,
                        list(response.keys()) if isinstance(response, dict) else type(response).__name__,
                    )
                except Exception as e:
                    last_error = e
                    logger.warning(
                        'chat_with_retry: failed task=%s attempt=%s/%s model=%s error_type=%s error=%r',
                        task,
                        attempt + 1,
                        retries,
                        model,
                        type(e).__name__,
                        e,
                    )
                    continue

            if attempt < retries - 1:
                logger.info(
                    'chat_with_retry: retry backoff task=%s next_attempt=%s sleep_seconds=%s',
                    task,
                    attempt + 2,
                    min(2 ** attempt, 3),
                )
                await asyncio.sleep(min(2 ** attempt, 3))

        logger.error(
            'chat_with_retry: exhausted task=%s retries=%s last_error_type=%s last_error=%r',
            task,
            retries,
            type(last_error).__name__ if last_error else None,
            last_error,
        )
        raise last_error or Exception("All retry attempts failed")

    async def _call(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, Any]] = None,
        request_timeout_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Make a single API call."""
        logger.info(
            '_call: model=%s temperature=%s max_tokens=%s response_format=%s message_count=%s request_timeout_seconds=%s',
            model,
            temperature,
            max_tokens,
            response_format,
            len(messages),
            request_timeout_seconds,
        )
        return await self.client.chat(
            model,
            messages,
            temperature,
            max_tokens,
            response_format,
            request_timeout_seconds=request_timeout_seconds,
        )

    def _validate_response(self, response: Dict[str, Any]) -> bool:
        """Validate response structure."""
        if not response or "choices" not in response or not response["choices"]:
            return False
        
        choice = response["choices"][0]
        if not isinstance(choice, dict):
            return False
        
        message = choice.get("message", {})
        if not isinstance(message, dict):
            return False
        
        content = message.get("content")
        if content is None:
            return False

        if isinstance(content, str) and not content.strip():
            return False

        if isinstance(content, list):
            text_content = self._coerce_content_to_text(content)
            if not text_content:
                return False
        
        return True

    @staticmethod
    def extract_json(content: str) -> str:
        """Extract valid JSON from content using multiple strategies."""
        if not content:
            return "{}"

        # Remove BOM if present
        if content.startswith('﻿'):
            content = content[1:]

        content = content.strip()

        # Remove markdown code blocks
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]

        if content.endswith("```"):
            content = content[:-3]

        content = content.strip()

        # Strategy 1: Find JSON object with balanced brace matching
        def extract_balanced(start_char: str, end_char: str, content: str) -> Optional[str]:
            start = content.find(start_char)
            if start < 0:
                return None
            depth = 0
            for i in range(start, len(content)):
                if content[i] == start_char:
                    depth += 1
                elif content[i] == end_char:
                    depth -= 1
                    if depth == 0:
                        try:
                            candidate = content[start:i+1]
                            json.loads(candidate)
                            return candidate
                        except:
                            return None
            return None

        # Try to extract JSON object
        result = extract_balanced('{', '}', content)
        if result:
            return result

        # Try to extract JSON array
        result = extract_balanced('[', ']', content)
        if result:
            return result

        # Strategy 2: Regex-based extraction for JSON objects
        json_objects = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content)
        for obj in json_objects:
            try:
                json.loads(obj)
                return obj
            except:
                continue

        # Strategy 3: Find first { and last } as fallback
        start = content.find("{")
        end = content.rfind("}")

        if start >= 0 and end > start:
            candidate = content[start:end+1]
            try:
                json.loads(candidate)
                return candidate
            except:
                pass

        return "{}"

    @staticmethod
    def try_parse_json(content: str) -> Optional[Dict[str, Any]]:
        """Try to parse JSON with multiple fallback strategies."""
        if not content or len(content) < 10:
            return None

        # Strategy 1: Direct parse
        try:
            return json.loads(content)
        except Exception as e:
            pass  # try next strategy

        # Strategy 2: Extract from first { to last }
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end+1])
            except:
                pass

        # Strategy 3: Fix common JSON issues (single quotes, backticks)
        try:
            fixed = content.replace("'", '"').replace("`", '"')
            # Remove trailing commas before } or ]
            fixed = re.sub(r',\s*([}\]])', r'\1', fixed)
            return json.loads(fixed)
        except:
            pass

        # Strategy 4: Try with json.JSONDecodeError tolerance
        try:
            # Find all {...} patterns and try to parse each
            matches = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content)
            for match in matches:
                try:
                    return json.loads(match)
                except:
                    continue
        except:
            pass

        return None

    @staticmethod
    def _recover_quiz_payload_from_partial(content: str, question_number: int) -> Optional[Dict[str, Any]]:
        """Best-effort recovery when model returns truncated JSON for quiz payload."""
        if not isinstance(content, str) or not content.strip():
            return None

        question_match = re.search(r'"question"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)', content)
        if not question_match:
            return None

        question = question_match.group(1).strip()
        if not question:
            return None

        options: List[Dict[str, str]] = []
        option_pattern = re.compile(
            r'\{\s*"id"\s*:\s*"([A-Za-z0-9_\-]+)"\s*,\s*"label"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)',
            re.DOTALL,
        )
        for match in option_pattern.finditer(content):
            opt_id = match.group(1).strip().upper()
            label = match.group(2).strip()
            if not label:
                continue
            options.append({"id": opt_id, "label": label})
            if len(options) >= 4:
                break

        return {
            "question": question,
            "options": options,
            "questionNumber": question_number,
        }

    @staticmethod
    def _coerce_content_to_text(content: Any) -> str:
        """Normalize OpenRouter message content into plain text."""
        if isinstance(content, str):
            return content

        if isinstance(content, dict):
            text = content.get("text")
            if isinstance(text, str):
                return text.strip()
            block_content = content.get("content")
            if isinstance(block_content, str):
                return block_content.strip()
            if isinstance(block_content, list):
                return AIOrchestrator._coerce_content_to_text(block_content)

        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        parts.append(text)
                    item_content = item.get("content")
                    if isinstance(item_content, str):
                        parts.append(item_content)
                    elif isinstance(item_content, list):
                        nested = AIOrchestrator._coerce_content_to_text(item_content)
                        if nested:
                            parts.append(nested)
                elif isinstance(item, str):
                    parts.append(item)
            return "\n".join([p for p in parts if p]).strip()

        return str(content) if content is not None else ""

    @staticmethod
    def _get_nova_question_blueprint(question_number: int) -> Dict[str, Any]:
        index = max(0, min(question_number - 1, len(NOVA_QUIZ_BLUEPRINTS) - 1))
        return NOVA_QUIZ_BLUEPRINTS[index]

    @staticmethod
    def _get_previous_answer_summary(previous_questions: List[Dict[str, Any]]) -> str:
        if not previous_questions:
            return "none"
        parts: List[str] = []
        for q in previous_questions[-5:]:  # last 5 for full context
            if isinstance(q, dict):
                topic = q.get("question", "")[:60]
                label = q.get("selectedLabel") or q.get("answer", "")[:60]
                if topic or label:
                    parts.append(f"Q: {topic} | A: {label}")
            elif isinstance(q, str) and q.strip():
                parts.append(q.strip()[:80])
        return "\n".join(parts) if parts else "none"

    @classmethod
    def _build_nova_question_prompt(cls, question_number: int, previous_questions: List[Dict[str, Any]]) -> str:
        blueprint = cls._get_nova_question_blueprint(question_number)
        previous_context = cls._get_previous_answer_summary(previous_questions)

        return f"""### Instruction
Generate ONE unique, contextually-adaptive Nova Global Profile question for step {question_number} of 10.

### Nova Profile Principles
Nova measures relational intelligence across: behavioral style, motivation, cognition, communication, and work preferences.
Questions must collectively reveal the user's dominant DISC pattern (Dominance, Conscientiousness, Steadiness, Influence).

### Question Requirements
- The question must be GENERATED FRESH — do NOT use or adapt the seed question below
- It must explore the same broad DISC dimension as the blueprint focus, but from a different angle
- Each question must feel like a natural conversation follow-up given the previous answers
- Avoid any wording or scenario that directly duplicates a previous question (even rephrased)
- Option labels must be distinct from all previously-seen labels

### Current Blueprint Focus
- DISC dimension: {blueprint['focus']}
- Intent: {blueprint['intent']}

### Previous Q&A History
{previous_context}

### Output Rules
- Return only valid JSON
- Exactly 4 options with unique ids B, V, O, A
- Each option label maps to a DIFFERENT DISC style: B=Conscientiousness, V=Steadiness, O=Dominance, A=Influence
- Labels must be short (under 60 chars), specific, and non-overlapping in meaning
- The question must be genuinely different from any previous question even if covering the same DISC area

### Required Schema
{{"question":"string","options":[{{"id":"B","label":"string","icon":"string"}},{{"id":"V","label":"string","icon":"string"}},{{"id":"O","label":"string","icon":"string"}},{{"id":"A","label":"string","icon":"string"}}],"questionNumber":{question_number}}}

### Icon Requirements
Pick icon values EXACTLY from this list (one per option):
analytics, people, globe, locate, flash, trophy, school, heart, star, bulb, book, time, document, call, videocam, chatbubble-ellipses, shield-checkmark, fitness, car, home, wallet, ear, code, construct, hand-left, briefcase, ribbon, color-palette, pulse, bookmark

Map icons to the option that best matches its meaning: analytics→analysis, people→team/support, globe→creativity/influence, flash→speed/action, trophy→achievement, school→learning, etc.
"""

    @staticmethod
    def _normalize_quiz_payload(parsed: Dict[str, Any], question_number: int) -> Optional[Dict[str, Any]]:
        """Normalize AI quiz payload to a strict, backend-safe shape."""
        if not isinstance(parsed, dict):
            return None

        question = parsed.get("question")
        if not isinstance(question, str) or not question.strip():
            return None

        # Guard: if the "question" looks like an answer label (too short, no question mark,
        # or matches a DISC label pattern), reject it — the model likely confused fields.
        q_text = question.strip()
        if (
            len(q_text) < 10
            or q_text.endswith((".", "!"))
            or not any(q_text.lower().startswith(w) for w in ("when", "how", "what", "which", "where", "why", "who", "would", "do you", "can you", "if "))
            and "?" not in q_text
        ):
            logger.warning(
                "generate_quiz_next: question field rejected as answer label (len=%s, text=%s)",
                len(q_text),
                q_text[:60],
            )
            return None

        raw_options = parsed.get("options")
        if not isinstance(raw_options, list) or not raw_options:
            return None

        expected_ids = ["B", "V", "O", "A"]
        # DISC-to-icon mapping: each DISC dimension maps to a default icon
        # Icons must be valid Ionicons names (matching ICON_MAP in QuizScreen.tsx)
        disc_default_icons = {
            "B": "analytics",   # Conscientiousness — structured, analytical
            "V": "people",      # Steadiness — collaborative, supportive
            "O": "flash",       # Dominance — fast, action-oriented
            "A": "globe",       # Influence — creative, expansive
        }
        valid_icon_names = {
            "analytics", "people", "globe", "locate", "flash", "trophy", "school",
            "heart", "star", "bulb", "book", "time", "document", "call", "videocam",
            "chatbubble-ellipses", "shield-checkmark", "fitness", "car", "home",
            "wallet", "ear", "code", "construct", "hand-left", "briefcase", "ribbon",
            "color-palette", "pulse", "bookmark", "ellipse", "map", "checkmark",
            "checkmark-circle", "alert-circle", "settings", "trending-up", "cash",
            "sparkles", "person", "person-outline", "arrow-back", "reload",
        }

        normalized_options: List[Dict[str, str]] = []
        seen_ids = set()
        sequential_labels: List[str] = []

        for idx, option in enumerate(raw_options[:8]):
            option_id = expected_ids[idx] if idx < len(expected_ids) else None
            label = ""
            icon = disc_default_icons.get(option_id or "B", "analytics")

            if isinstance(option, dict):
                raw_id = option.get("id")
                if isinstance(raw_id, str) and raw_id.strip():
                    option_id = raw_id.strip().upper()
                raw_label = option.get("label")
                if isinstance(raw_label, str):
                    label = raw_label.strip()
                if not label:
                    alt_text = option.get("text") or option.get("option") or option.get("title")
                    if isinstance(alt_text, str):
                        label = alt_text.strip()
                raw_icon = option.get("icon")
                if isinstance(raw_icon, str) and raw_icon.strip():
                    raw_icon_normalized = raw_icon.strip().lower().replace("-", "").replace("_", "")
                    # Validate: if not in valid set, fall back to DISC default
                    if raw_icon_normalized in {i.replace("-", "").replace("_", "") for i in valid_icon_names}:
                        icon = raw_icon.strip()
                    else:
                        logger.warning(
                            "generate_quiz_next: invalid icon '%s' for option %s, falling back to '%s'",
                            raw_icon,
                            option_id,
                            icon,
                        )
                        icon = disc_default_icons.get(option_id or "B", "analytics")
            elif isinstance(option, str):
                label = option.strip()

            if not label:
                continue

            # Keep a sequential backup so we can remap A/B/C/D-style IDs to B/V/O/A.
            if len(sequential_labels) < 4:
                sequential_labels.append(label)

            if option_id not in {"B", "V", "O", "A"}:
                continue

            if option_id in seen_ids:
                continue

            normalized_options.append({
                "id": option_id,
                "label": label,
                "icon": icon,
            })
            seen_ids.add(option_id)

            if len(normalized_options) == 4:
                break

        current_ids = {opt["id"] for opt in normalized_options}
        if current_ids != {"B", "V", "O", "A"}:
            # If the model gave 4 option labels but used non-standard IDs (A/B/C/D, 1/2/3/4, etc.),
            # remap by position to the required B/V/O/A order.
            if len(sequential_labels) >= 4:
                normalized_options = [
                    {
                        "id": expected_id,
                        "label": sequential_labels[idx],
                        "icon": disc_default_icons[expected_id],
                    }
                    for idx, expected_id in enumerate(expected_ids)
                ]
            # If we have fewer than 4 sequential labels, continue and backfill missing options.

        # Backfill any blank/missing labels and icons defensively for partially truncated model outputs.
        normalized_by_id = {opt["id"]: opt for opt in normalized_options}
        default_labels = {
            "B": "Review details and plan",
            "V": "Coordinate and support the team",
            "O": "Decide quickly and execute",
            "A": "Explore a creative approach",
        }
        for expected_id in expected_ids:
            if expected_id not in normalized_by_id:
                normalized_by_id[expected_id] = {
                    "id": expected_id,
                    "label": default_labels[expected_id],
                    "icon": disc_default_icons[expected_id],
                }
                continue

            existing_label = normalized_by_id[expected_id].get("label")
            if not isinstance(existing_label, str) or not existing_label.strip():
                normalized_by_id[expected_id]["label"] = default_labels[expected_id]

            existing_icon = normalized_by_id[expected_id].get("icon")
            if not isinstance(existing_icon, str) or not existing_icon.strip():
                normalized_by_id[expected_id]["icon"] = disc_default_icons[expected_id]
            else:
                # Validate icon even on backfill - normalize and check
                icon_normalized = existing_icon.lower().replace("-", "").replace("_", "")
                if icon_normalized not in {i.replace("-", "").replace("_", "") for i in valid_icon_names}:
                    normalized_by_id[expected_id]["icon"] = disc_default_icons[expected_id]

        normalized_options = [normalized_by_id[expected_id] for expected_id in expected_ids]

        normalized_options.sort(key=lambda opt: expected_ids.index(opt["id"]))

        return {
            "question": question.strip(),
            "options": normalized_options,
            "questionNumber": question_number,
        }

    async def close(self):
        """Close the client."""
        if self.client:
            await self.client.close()

    def _get_nova_fallback_question(self, question_number: int) -> Dict[str, Any]:
        """Fallback Nova question bank aligned to relational intelligence principles."""
        q = self._get_nova_question_blueprint(question_number)
        return {
            "question": q["question"],
            "options": q["options"],
            "questionNumber": question_number,
        }

    @staticmethod
    def _build_quiz_session_payload(quiz_session: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        payload: List[Dict[str, Any]] = []
        for item in quiz_session or []:
            if not isinstance(item, dict):
                continue
            
            question_number = item.get("questionNumber") or item.get("question_number")
            question = item.get("question", "")
            selected_option = item.get("selectedLabel") or item.get("selectedOption") or item.get("answer") or ""
            raw_options = item.get("allOptions") or item.get("options") or []
            
            all_options = []
            if isinstance(raw_options, list):
                for opt in raw_options:
                    if isinstance(opt, dict):
                        all_options.append({
                            "id": opt.get("id", ""),
                            "label": opt.get("label", "") or opt.get("text", ""),
                        })
                    elif isinstance(opt, str):
                        all_options.append({
                            "id": "",
                            "label": opt,
                        })
            
            payload.append({
                "questionNumber": question_number,
                "question": question,
                "selectedOption": selected_option,
                "allOptions": all_options,
            })
        return payload

    async def generate_quiz_next(self, answers: List[str], question_number: int, previous_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get next quiz question using AI."""
        try:
            prompt = self._build_nova_question_prompt(question_number, previous_questions)

            response = await self.chat_with_retry(
                "quiz",
                [{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=700,
                response_format={"type": "json_schema", "json_schema": QUIZ_QUESTION_SCHEMA},
            )


            content = self._coerce_content_to_text(response["choices"][0]["message"].get("content"))
            json_str = self.extract_json(content)
            parsed = self.try_parse_json(json_str)
            if not parsed:
                parsed = self._recover_quiz_payload_from_partial(content, question_number)

            normalized = self._normalize_quiz_payload(parsed, question_number) if parsed else None
            if normalized:
                # Verify options don't look like answer labels (guard against field confusion)
                option_labels = [opt.get("label", "") for opt in normalized.get("options", [])]
                if any(len(l) > 80 for l in option_labels):  # DISC answer labels are ~40-60 chars
                    logger.warning(
                        "generate_quiz_next: options rejected — labels too long (likely answers), falling back",
                    )
                    normalized = None
                else:
                    logger.info(f"generate_quiz_next: AI Q{question_number}")
                    return normalized

            # Log what we got for debugging
            parsed_question = parsed.get("question") if isinstance(parsed, dict) else None
            question_preview = parsed_question[:30] if isinstance(parsed_question, str) else None
            options_count = len(parsed.get("options", [])) if isinstance(parsed, dict) and isinstance(parsed.get("options"), list) else 0
            content_preview = content[:180].replace("\n", " ") if isinstance(content, str) else ""
            logger.warning(
                "generate_quiz_next: partial parse - question=%s, options=%s, content_preview=%s",
                question_preview,
                options_count,
                content_preview,
            )

        except Exception as e:
            logger.warning(f"generate_quiz_next error: {e}")

        return self._get_nova_fallback_question(question_number)

    async def generate_quiz_results(self, quiz_session: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate a Nova Global Profile report from the full quiz session.

        The AI analyzes ALL 10 Q&A pairs to compute DISC percentages, then writes
        the full profile (behavior, motivations, cognition, career projection) around
        those computed values.
        """
        try:
            session_payload = self._build_quiz_session_payload(quiz_session)
            session_json = json.dumps(session_payload, ensure_ascii=True, indent=2)
            logger.info(
                'generate_quiz_results: session_items=%s payload_chars=%s',
                len(session_payload),
                len(session_json),
            )

            prompt = f"""### Task
Analyze ALL 10 quiz Q&A pairs to build a complete Nova Global Profile.
Step 1: Compute the user's DISC percentages from the answers.
Step 2: Write the full profile using those DISC values as the foundation.

### Step 1 — DISC Analysis
For each of the 10 questions, identify which DISC style the SELECTED ANSWER reflects:
- RED/Dominance (D): leading, deciding fast, results, competition, challenge, taking charge
- YELLOW/Influence (I): inspiring, persuading, socializing, entertaining, ideas, enthusiasm
- GREEN/Steadiness (S): supporting, helping, listening, cooperating, stabilizing, sustaining
- BLUE/Conscientiousness (C): planning, analyzing, organizing, quality, precision, expertise

Count answers per DISC style across ALL 10 questions (each = 10%, total = 100%).
Dominant = highest count. Compute percentages as: (count × 10)%.

Example: 4 Blue, 3 Green, 2 Red, 1 Yellow → Blue=40%, Green=30%, Red=20%, Yellow=10%

### Step 2 — Full Nova Profile
Write the complete profile using the computed DISC percentages.

### Quiz Session (10 Q&As — use ALL of them)
{session_json}

### Output Schema — Return ONLY valid JSON, no markdown, no code fences:

{{
    "discAnalysis": {{
        "red": <0 or 10 or 20 or 30 or 40 or 50 or 60 or 70 or 80 or 90 or 100>,
        "yellow": <0-100>,
        "green": <0-100>,
        "blue": <0-100>,
        "dominant": "<red|yellow|green|blue>"
    }},
    "novaProfile": {{
        "headline": "<1 sentence career coaching headline tied to dominant style>",
        "professionalIdentity": "<1 sentence work style identity>",
        "behavior": {{
            "primaryStyle": "<full name e.g. 'Conscientiousness (Blue)'>",
            "secondaryStyle": "<second highest or null if dominant >= 60>",
            "traits": ["<trait1>", "<trait2>", "<trait3>"],
            "discBlend": "<e.g. 'R20 / Y30 / G30 / B20'>",
            "discPercentages": {{
                "red": <0-100>,
                "yellow": <0-100>,
                "green": <0-100>,
                "blue": <0-100>
            }}
        }},
        "styleComparison": {{
            "naturalStyleSummary": "<2-3 sentences on how they behave when comfortable>",
            "adaptedStyleSummary": "<2-3 sentences on how they adapt professionally>",
            "adaptationDrivers": ["<driver1>", "<driver2>", "<driver3>"],
            "stressSignals": ["<signal1>", "<signal2>", "<signal3>"]
        }},
        "motivations": {{
            "topMotivators": ["<what drives them most>"],
            "demotivators": ["<what frustrates or disengages them>"],
            "valuesSummary": "<2 sentences connecting their DISC to values>"
        }},
        "cognition": {{
            "decisionStyle": "<how they make decisions>",
            "thinkingStyle": "<how they approach problems and thinking>",
            "learningStyle": "<how they prefer to learn>",
            "communicationStyle": "<how they communicate with others>"
        }},
        "careerProjection": {{
            "bestFitEnvironments": ["<env1>", "<env2>", "<env3>"],
            "leadershipStyle": "<their natural leadership approach>",
            "watchouts": ["<behavioral watchout 1>", "<2>", "<3>"],
            "futureFocus": "<1 sentence on career direction>"
        }},
        "recommendedDevelopmentAxes": ["<axis1>", "<axis2>", "<axis3>", "<axis4>"]
    }}
}}

### Writing Rules
- DISC percentages MUST sum to exactly 100
- discBlend MUST match the percentages exactly (e.g. R20 / Y30 / G30 / B20)
- Every field must be specific — reference actual question themes from the session
- Do NOT use generic phrases like "your unique blend" or "varies by situation"
- RED traits (high D): Decisive, Competitive, Impatient, Bold, Direct
- YELLOW traits (high I): Enthusiastic, Persuasive, Spontaneous, Optimistic, Social
- GREEN traits (high S): Patient, Loyal, Supportive, Calm, Consistent
- BLUE traits (high C): Analytical, Systematic, Perfectionist, Precise, Thorough
- Do NOT return markdown or code fences
"""

            logger.info(
                'generate_quiz_results: prompt_chars=%s prompt_preview=%s',
                len(prompt),
                prompt[:220].replace('\n', ' '),
            )
            
            response = await self.chat_with_retry(
                "quiz_results",
                [{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=8800,
                retries=2,
                request_timeout_seconds=90,
                response_format={"type": "json_schema", "json_schema": NOVA_PROFILE_SCHEMA},
            )

            logger.info(
                'generate_quiz_results: raw_response_keys=%s',
                list(response.keys()) if isinstance(response, dict) else type(response).__name__,
            )

            raw_content = response["choices"][0]["message"].get("content", "")
            content = self._coerce_content_to_text(raw_content)
            logger.info(
                'generate_quiz_results: content_type=%s content_chars=%s content_preview=%s',
                type(content).__name__,
                len(content) if isinstance(content, str) else 'n/a',
                content[:220].replace('\n', ' ') if isinstance(content, str) else str(content)[:220],
            )
            json_str = self.extract_json(content)
            parsed = self.try_parse_json(json_str)
            if isinstance(parsed, list):
                logger.warning('generate_quiz_results: parsed as list, retrying on raw content')
                parsed = self.try_parse_json(content)
            logger.info(
                'generate_quiz_results: parsed_type=%s parsed_keys=%s',
                type(parsed).__name__ if parsed is not None else 'None',
                list(parsed.keys()) if isinstance(parsed, dict) else None,
            )
            if isinstance(parsed, dict):
                nova_profile = parsed.get("novaProfile")
                if isinstance(nova_profile, dict) and nova_profile:
                    logger.info(
                        'generate_quiz_results: success with novaProfile keys=%s',
                        list(nova_profile.keys()),
                    )
                    return {"novaProfile": nova_profile, "_ai_generated": True}
                if "headline" in parsed and "behavior" in parsed:
                    logger.info('generate_quiz_results: success with flattened profile keys=%s', list(parsed.keys()))
                    return {"novaProfile": parsed, "_ai_generated": True}

            logger.warning(
                'generate_quiz_results: parse failed or empty novaProfile, content_preview=%s',
                content[:500].replace('\n', ' ') if isinstance(content, str) else str(content)[:500],
            )
            raise ValueError(f"AI returned invalid/empty novaProfile: {content[:200] if content else 'empty'}")
        except ValueError:
            raise
        except Exception as e:
            logger.warning(f"generate_quiz_results error: {type(e).__name__}: {e!r}")
            raise

    async def analyze_cv(self, pdf_text: str) -> Dict[str, Any]:
        """Analyze CV text and extract information using Prompt Anatomy."""
        if not pdf_text or len(pdf_text.strip()) < 50:
            return {"skills": [], "ats_score": 50, "ats_issues": [], "suggested_improvements": []}
        
        text = pdf_text[:4000]
        
        # Prompt Anatomy Structure (MED-04 Standard)
        prompt = f"""### Instruction
Analyze this CV/resume and extract structured professional information for ATS scoring.

### Context
You are a senior HR analyst specializing in Applicant Tracking Systems (ATS). Your role is to:
1. Extract all technical skills, programming languages, frameworks, and tools
2. Identify years of professional experience and career level
3. Score the CV from 0-100 based on ATS optimization
4. Identify issues that cause ATS rejection or low scores
5. Provide actionable improvements to increase interview chances

### Input Data
CV Text:
{text}

### Few-Shot Example
Input: "John Doe - Python Developer at Google 5 years. Skills: Python, React, AWS."
Output: {{"skills": ["Python", "React", "AWS"], "experience_years": 5, "education": [], "summary": "Python Developer with 5 years experience", "ats_score": 70, "ats_issues": [{{"title": "Missing Education", "severity": "medium", "description": "Education section not found"}}], "suggested_improvements": [{{"section": "Education", "suggestion": "Add degree and institution", "example": "BS Computer Science, MIT"}}]}}

### Output Indicator
Return ONLY valid JSON with these exact fields:
- skills: array of strings (technical skills only)
- interests: array of strings (non-technical interests if mentioned)
- experience_years: integer (total years of professional experience)
- education: array of strings (degrees, institutions, graduation years)
- summary: string (2-3 sentence professional summary)
- ats_score: integer 0-100 (ATS optimization score)
- ats_issues: array of objects with title, severity (critical/high/medium/low), description
- suggested_improvements: array of objects with section, suggestion, example

### Negative Constraints
- Do NOT fabricate skills not present in the CV
- Do NOT include soft skills in the skills array (communication, teamwork, etc.)
- Do NOT exceed 10 skills in the skills array
- Only use "critical" severity for deal-breaking issues (missing contact info, etc.)
- Ensure ats_score reflects actual ATS optimization, not just content completeness
"""
        
        try:
            response = await self.chat_with_retry(
                "cv",
                [{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2500,
            )
            
            content = response["choices"][0]["message"]["content"]
            json_str = self.extract_json(content)
            parsed = self.try_parse_json(json_str)
            
            if parsed and parsed.get("skills"):
                return {
                    "skills": parsed.get("skills", []),
                    "extracted_skills": parsed.get("skills", []),
                    "extracted_interests": parsed.get("interests", []),
                    "interests": parsed.get("interests", []),
                    "experience_years": parsed.get("experience_years", 0),
                    "education": parsed.get("education", []),
                    "summary": parsed.get("summary", "Analysis complete"),
                    "ats_score": parsed.get("ats_score", 50),
                    "ats_issues": parsed.get("ats_issues", []),
                    "suggested_improvements": parsed.get("suggested_improvements", []),
                }
            logger.warning(f"analyze_cv: Falling back - content: {content[:200]}")
        except Exception as e:
            logger.warning(f"analyze_cv failed: {e}")
        
        return self._extract_cv_fallback(text)

    def _extract_cv_fallback(self, text: str) -> Dict[str, Any]:
        """Fallback extraction using simple patterns."""
        tech_skills = ["python", "javascript", "java", "react", "node", "sql", "aws", "docker", "kubernetes", "git", "html", "css", "typescript", "angular", "vue", "php", "ruby", "go", "rust", "c++", "c#", "ruby", "swift", "kotlin"]
        
        found_skills = []
        text_lower = text.lower()
        for skill in tech_skills:
            if skill in text_lower:
                found_skills.append(skill.title())
        
        years = 0
        year_matches = re.findall(r'(\d+)\+?\s*years?', text_lower)
        if year_matches:
            years = max([int(y) for y in year_matches])
        
        return {
            "skills": found_skills[:10],
            "experience_years": years,
            "education": [],
            "summary": f"Found {len(found_skills)} skills, {years} years experience.",
            "ats_score": 50,
            "ats_issues": [],
            "suggested_improvements": [],
        }

    def _build_market_search_plan(self, career: Dict[str, Any]) -> List[Dict[str, str]]:
        """Build focused DuckDuckGo search queries for a career market snapshot."""
        title = str(career.get("title") or "").strip()
        category = str(career.get("category") or "").strip()
        required_skills = career.get("required_skills") or []
        skill_hint = " ".join(required_skills[:3]) if isinstance(required_skills, list) else ""

        base_queries = [
            f"{title} salary 2025",
            f"{title} job outlook 2025",
            f"{title} demand outlook",
        ]

        if category:
            base_queries.append(f"{title} {category} salary outlook")

        lower_title = title.lower()
        if any(word in lower_title for word in ["developer", "engineer", "programmer", "software", "data", "cloud", "devops"]):
            base_queries.extend([
                f"{title} salary range seniority 2025",
                f"{title} growth rate job market 2025",
                f"{title} most in demand skills 2025 {skill_hint}".strip(),
            ])
        elif any(word in lower_title for word in ["manager", "analyst", "consultant", "product", "business"]):
            base_queries.extend([
                f"{title} average salary market 2025",
                f"{title} job growth outlook",
                f"{title} skills in demand 2025 {skill_hint}".strip(),
            ])
        elif any(word in lower_title for word in ["designer", "ux", "ui", "creative", "marketing"]):
            base_queries.extend([
                f"{title} salary outlook 2025",
                f"{title} hiring demand 2025",
                f"{title} skills employers want {skill_hint}".strip(),
            ])
        else:
            base_queries.extend([
                f"{title} annual salary 2025",
                f"{title} job growth 2025",
                f"{title} hiring demand and skills",
            ])

        if skill_hint:
            base_queries.append(f"{title} {skill_hint} salary demand")

        # Keep the set small and focused.
        seen = set()
        plan: List[Dict[str, str]] = []
        for query in base_queries:
            clean = query.strip()
            if not clean or clean.lower() in seen:
                continue
            seen.add(clean.lower())
            plan.append({
                "query": clean,
                "purpose": "salary" if "salary" in clean.lower() or "pay" in clean.lower() else (
                    "growth" if any(token in clean.lower() for token in ["growth", "outlook", "market"])
                    else "demand"
                ),
            })
        return plan[:6]

    def _parse_salary_value(self, raw: str) -> Optional[int]:
        text = raw.replace(",", "").lower()

        # Prefer ranges like $80k-$120k or 80k to 120k.
        range_match = re.search(r'\$?\s*(\d{2,3})(?:\.(\d))?\s*k\s*(?:-|to|–|—)\s*\$?\s*(\d{2,3})(?:\.(\d))?\s*k', text)
        if range_match:
            low = float(f"{range_match.group(1)}.{range_match.group(2) or '0'}") * 1000
            high = float(f"{range_match.group(3)}.{range_match.group(4) or '0'}") * 1000
            return int(round((low + high) / 2))

        value_match = re.search(r'\$?\s*(\d{2,3}(?:\.\d+)?)\s*k', text)
        if value_match:
            return int(round(float(value_match.group(1)) * 1000))

        value_match = re.search(r'\$\s*(\d{4,6})', text)
        if value_match:
            return int(value_match.group(1))

        return None

    def _parse_growth_percent(self, raw: str) -> Optional[float]:
        text = raw.lower()
        percent_matches = [float(m) for m in re.findall(r'(\d+(?:\.\d+)?)\s*%', text)]
        if percent_matches:
            # Pick the first meaningful growth-related percentage.
            for value in percent_matches:
                if 0 <= value <= 100:
                    return value
        return None

    def _score_demand_from_text(self, text: str) -> Tuple[Optional[str], int]:
        lowered = text.lower()
        high_hits = sum(1 for term in ["high demand", "very high demand", "in demand", "hiring", "strong demand", "shortage"] if term in lowered)
        medium_hits = sum(1 for term in ["steady demand", "moderate demand", "growth", "outlook"] if term in lowered)
        low_hits = sum(1 for term in ["declining", "low demand", "limited openings"] if term in lowered)

        if high_hits >= 2:
            return "very-high", high_hits
        if high_hits == 1:
            return "high", high_hits
        if low_hits > 0 and low_hits >= medium_hits:
            return "low", low_hits
        if medium_hits > 0:
            return "medium", medium_hits
        return None, 0

    async def extract_career_market_intel(self, title: str, snippets: List[str], cache_ttl: int = 86400) -> Optional[Dict[str, Any]]:
        """Turn DuckDuckGo snippets into a structured market snapshot.

        The caller supplies snippets gathered from the search plan; we infer salary,
        growth and demand from the evidence and return a confidence-scored result.
        """
        try:
            if not title:
                return None

            combined_text = "\n".join(snippets or [])
            salary_values: List[int] = []
            growth_values: List[float] = []
            demand_votes: Dict[str, int] = {"very-high": 0, "high": 0, "medium": 0, "low": 0}

            # Parse each snippet separately so one noisy result does not dominate.
            for snippet in snippets or []:
                salary = self._parse_salary_value(snippet)
                if salary:
                    salary_values.append(salary)

                growth = self._parse_growth_percent(snippet)
                if growth is not None and growth > 0:
                    growth_values.append(growth)

                demand_level, vote_strength = self._score_demand_from_text(snippet)
                if demand_level:
                    demand_votes[demand_level] += vote_strength or 1

            # Use broader title-level context if the snippets are weak.
            title_lower = title.lower()
            if not growth_values and any(token in title_lower for token in ["developer", "engineer", "data", "cloud", "software", "ai", "security"]):
                growth_values.append(15.0)
            if not growth_values and any(token in title_lower for token in ["nurse", "teacher", "sales", "analyst", "manager", "designer"]):
                growth_values.append(8.0)

            # Salary fallback by role family if the web snippets are ambiguous.
            if not salary_values:
                if any(token in title_lower for token in ["software", "developer", "engineer", "data", "cloud", "devops", "ai", "security"]):
                    salary_values.extend([95000, 120000])
                elif any(token in title_lower for token in ["manager", "consultant", "product", "analyst", "marketing", "business"]):
                    salary_values.extend([70000, 105000])
                elif any(token in title_lower for token in ["designer", "ux", "ui", "creative"]):
                    salary_values.extend([65000, 95000])
                else:
                    salary_values.extend([60000, 90000])

            salary_min = min(salary_values) if salary_values else None
            salary_max = max(salary_values) if salary_values else None
            average_salary = int(round((salary_min + salary_max) / 2)) if salary_min and salary_max else None

            growth_rate = round(sum(growth_values) / len(growth_values), 1) if growth_values else None
            if growth_rate is None:
                growth_rate = 10.0

            demand_level = max(demand_votes.items(), key=lambda item: item[1])[0]
            if demand_votes[demand_level] == 0:
                demand_level = "medium"

            evidence_hits = sum(1 for item in [salary_values, growth_values, [demand_level]] if item)
            confidence = min(0.95, 0.35 + (0.18 * evidence_hits) + (0.05 * len(snippets or [])))

            return {
                "salary_min": salary_min,
                "salary_max": salary_max,
                "average_salary": average_salary,
                "growth_rate_percent": growth_rate,
                "demand_level": demand_level,
                "confidence": round(confidence, 2),
                "sources": [snippet[:280] for snippet in (snippets or [])[:8]],
            }
        except Exception as e:
            logger.warning(f"extract_career_market_intel failed for {title}: {e}")
            return None

    async def generate_career_explanation(
        self,
        career: Dict[str, Any],
        nova_profile: Dict[str, Any],
        match_score: Optional[int] = None,
        match_reasons: Optional[List[str]] = None,
    ) -> str:
        """Generate a detailed AI explanation for why a career matches the provided profile.

        Returns a short multi-sentence paragraph that references evidence from the profile.
        """
        try:
            reasons_text = "\n".join(f"- {reason}" for reason in (match_reasons or [])) or "- No deterministic reasons available"
            score_text = f"{match_score}%" if isinstance(match_score, int) else "unknown"
            prompt = f"""### Instruction
Write a detailed, human-friendly explanation describing why the following career is a good fit for this user profile.

The explanation must be specific, evidence-based, and grounded in the user's profile. Do not start with phrases like "Strong fit" or "Based on your profile".
Use 2 to 4 sentences and mention at least two concrete reasons.

Career fit score: {score_text}

Career:
Title: {career.get('title')}
Description: {career.get('description', '')}
Required skills: {json.dumps(career.get('required_skills', []), ensure_ascii=False)}
Tags: {json.dumps(career.get('tags', []), ensure_ascii=False)}

Deterministic match reasons:
{reasons_text}

User / Nova Profile:
{json.dumps(nova_profile, ensure_ascii=False, indent=2)[:4000]}

Output rules:
- Return plain text only (no JSON, no markdown).
- Mention skills, interests, traits, or DISC-style indicators where relevant.
- Avoid generic wording and avoid repeating the score verbatim as the entire answer.
"""

            response = await self.chat_with_retry(
                "career_explanation",
                [{"role": "user", "content": prompt}],
                temperature=0.35,
                max_tokens=2260,
                retries=1,
            )

            content = self._coerce_content_to_text(response["choices"][0]["message"].get("content", ""))
            cleaned = (content or "").strip()
            if cleaned:
                generic_pattern = re.compile(r"^strong\s+\d+%\s+based\s+on\s+your\s+profile\.?$", re.IGNORECASE)
                if len(cleaned) >= 70 and not generic_pattern.match(cleaned):
                    return cleaned

            fallback_reasons = match_reasons or []
            skill_phrase = ", ".join((career.get("required_skills") or [])[:3])
            trait_list = nova_profile.get("behavior", {}).get("traits") if isinstance(nova_profile, dict) else []
            trait_phrase = ", ".join([t for t in (trait_list or [])[:3] if isinstance(t, str)])
            reason_phrase = fallback_reasons[:2]

            parts = [
                f"This role matches your profile because it aligns with {skill_phrase or 'your current strengths'}.",
            ]
            if reason_phrase:
                parts.append("It also fits because " + "; ".join(reason_phrase) + ".")
            if trait_phrase:
                parts.append(f"Your profile also shows traits like {trait_phrase}, which support success in this path.")
            return " ".join(parts)
        except Exception as e:
            logger.warning(f"generate_career_explanation failed: {e}")
            reasons = match_reasons or []
            if reasons:
                return "This role fits your profile because " + "; ".join(reasons[:2]) + "."
            return "This role fits your profile based on the combined skills, interests, and behavioral signals from your quiz, CV, and Nova report."

    async def generate_careers_from_profile(self, profile: Dict[str, Any], cache_ttl: int = 21600) -> List[Dict[str, Any]]:
        """Use the LLM to shortlist and score careers given a combined profile.

        Expected profile keys (used where available):
        - quizAnswers: list of strings (selected options)
        - skills: list of skill strings
        - interests: list of interest strings
        - traits: list of trait strings
        - disc: dict of color counts or percentages
        - novaProfile: optional Nova report object
        - candidateCareers: list of candidate career objects from DB (id, title, description, required_skills, tags)
        - userProfileDetails: free-text profile fields

        Returns: list of objects with at least `title` and optional `id`, `score`, `reasons`.
        """
        try:
            # Prepare compact context
            candidate_careers = profile.get("candidateCareers") or []
            sample_careers = candidate_careers[:40]

            ctx = {
                "skills": profile.get("skills", []),
                "interests": profile.get("interests", []),
                "traits": profile.get("traits", []),
                "disc": profile.get("disc", {}),
                "quizAnswers": profile.get("quizAnswers", [])[:20],
                "novaProfile": profile.get("novaProfile") or {},
                "candidateCareers": sample_careers,
                "userProfileDetails": profile.get("userProfileDetails", {}),
            }

            prompt = f"""### Instruction
You are an expert career advisor. Given the user signals below (skills, interests, quiz answers and a Nova-style persona), return a JSON array of up to 10 career recommendations drawn from the provided candidate careers.

Context:
{json.dumps(ctx, ensure_ascii=False, indent=2)[:8000]}

Output rules:
- Return ONLY valid JSON: a top-level array of objects.
- Each object must include: `title` (string), `score` (integer 0-100), `reasons` (array of short strings). Optionally include `id` if it matches a candidate id and `suggested_next_steps` (array).
- Prefer titles that match the provided `candidateCareers` where possible. If you add a title not in candidateCareers, keep it realistic and common.
- Order the array from best fit to least fit.
- Keep `score` truthful and evidence-based (use skills, interests, DISC-like signals).

Example output:
[
  {"title":"Data Analyst","id":"abc123","score":87,"reasons":["Strong skill overlap: SQL, Excel","Enjoys analytical work"],"suggested_next_steps":["Build portfolio projects using pandas"]}
]
"""

            response = await self.chat_with_retry(
                "generate_careers",
                [{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=4200,
                retries=2,
                request_timeout_seconds=45,
            )

            raw = response["choices"][0]["message"].get("content", "")
            content = self._coerce_content_to_text(raw)
            json_str = self.extract_json(content)
            parsed = self.try_parse_json(json_str)
            if isinstance(parsed, list):
                # Normalize minimal fields
                normalized: List[Dict[str, Any]] = []
                for item in parsed:
                    if not isinstance(item, dict):
                        continue
                    normalized.append({
                        "title": item.get("title") or item.get("name") or "",
                        "id": item.get("id") or None,
                        "score": int(item.get("score") or item.get("match_score") or 0),
                        "reasons": item.get("reasons") or item.get("match_reasons") or [],
                        "suggested_next_steps": item.get("suggested_next_steps") or item.get("next_steps") or [],
                    })
                return normalized

            # Fallback: try parsing raw content
            parsed2 = self.try_parse_json(content)
            if isinstance(parsed2, list):
                return parsed2

            logger.warning("generate_careers_from_profile: LLM returned unexpected shape, content_preview=%s", (content or "")[:400])
        except Exception as e:
            logger.warning(f"generate_careers_from_profile failed: {type(e).__name__}: {e}")

        return []

    async def personalize_roadmap(
        self,
        roadmap_or_template: Any,
        user_profile: Any = None,
        nova_profile: Optional[Dict[str, Any]] = None,
        cv_summary: str = "",
        cache_ttl: int = 86400,
    ) -> Dict[str, Any]:
        """Personalize roadmap content using user profile signals.

        Supports two call styles for backward compatibility:
        1) personalize_roadmap(base_roadmap_dict, user_profile_dict)
        2) personalize_roadmap(base_roadmap_dict, skills_list, nova_profile_dict, cv_summary)
        """
        try:
            base_roadmap = roadmap_or_template if isinstance(roadmap_or_template, dict) else {}

            # Backward-compatible normalization for legacy callers.
            normalized_profile: Dict[str, Any] = {}
            if isinstance(user_profile, dict):
                normalized_profile = user_profile
            elif isinstance(user_profile, list):
                normalized_profile = {
                    "skills": user_profile,
                    "novaProfile": nova_profile or {},
                    "cvSummary": cv_summary,
                }

            role_title = (
                base_roadmap.get("career_title")
                or base_roadmap.get("title")
                or normalized_profile.get("selected_role")
                or "target role"
            )

            existing_steps = base_roadmap.get("steps", []) if isinstance(base_roadmap.get("steps"), list) else []
            existing_skills = base_roadmap.get("skills", []) if isinstance(base_roadmap.get("skills"), list) else []

            context = {
                "role": role_title,
                "existing_steps": existing_steps[:20],
                "existing_skills": existing_skills[:30],
                "user_profile": {
                    "skills": normalized_profile.get("skills", []),
                    "interests": normalized_profile.get("interests", []),
                    "quizAnswers": normalized_profile.get("quizAnswers", []),
                    "novaProfile": normalized_profile.get("novaProfile", {}),
                    "cvSummary": normalized_profile.get("cvSummary", ""),
                },
            }

            prompt = f"""### Instruction
Personalize this learning roadmap for the target role using the user profile.

### Context
{json.dumps(context, ensure_ascii=False, indent=2)[:10000]}

### Output Rules
- Return ONLY valid JSON.
- Keep output concise and practical.
- Respect prerequisite ordering in a realistic way.
- Add confidence_score in [0,1].
- Use fields exactly:
{{
  "steps": [
    {{
      "skill_name": "string",
      "why_it_matters": "string",
      "difficulty": "beginner|intermediate|advanced",
      "estimated_duration_hours": 8,
      "prerequisites": ["string"],
      "resource_title": "string or null",
      "provider": "string or null",
      "source_url": "string or null",
      "confidence_score": 0.8,
      "order_index": 0
    }}
  ]
}}
"""

            response = await self.chat_with_retry(
                "roadmap",
                [{"role": "user", "content": prompt}],
                temperature=0.35,
                max_tokens=2600,
                retries=2,
                request_timeout_seconds=45,
            )

            raw = response["choices"][0]["message"].get("content", "")
            content = self._coerce_content_to_text(raw)
            json_str = self.extract_json(content)
            parsed = self.try_parse_json(json_str) or self.try_parse_json(content)

            steps = parsed.get("steps") if isinstance(parsed, dict) else None
            if not isinstance(steps, list) or not steps:
                steps = existing_steps

            normalized_steps: List[Dict[str, Any]] = []
            for idx, step in enumerate(steps[:20]):
                if not isinstance(step, dict):
                    continue
                normalized_steps.append(
                    {
                        "skill_name": str(step.get("skill_name") or step.get("title") or f"Skill {idx + 1}"),
                        "why_it_matters": str(step.get("why_it_matters") or step.get("description") or "Build this capability for role success."),
                        "difficulty": str(step.get("difficulty") or "intermediate").lower(),
                        "estimated_duration_hours": max(1, int(step.get("estimated_duration_hours") or 8)),
                        "prerequisites": step.get("prerequisites") if isinstance(step.get("prerequisites"), list) else [],
                        "resource_title": step.get("resource_title"),
                        "provider": step.get("provider"),
                        "source_url": step.get("source_url"),
                        "confidence_score": float(step.get("confidence_score") or 0.7),
                        "order_index": idx,
                    }
                )

            # Legacy compatibility: roadmap.service expects personalizedMilestones.
            legacy_milestones = [
                {
                    "title": item["skill_name"],
                    "description": item["why_it_matters"],
                    "duration": f"{item['estimated_duration_hours']}h",
                    "skills": [item["skill_name"]],
                }
                for item in normalized_steps
            ]

            return {
                "steps": normalized_steps,
                "personalizedMilestones": legacy_milestones,
            }
        except Exception as e:
            logger.warning(f"personalize_roadmap failed: {type(e).__name__}: {e}")
            fallback_steps = []
            if isinstance(roadmap_or_template, dict):
                maybe_steps = roadmap_or_template.get("steps")
                if isinstance(maybe_steps, list):
                    fallback_steps = maybe_steps
            return {
                "steps": fallback_steps,
                "personalizedMilestones": [],
                "message": "Personalization fallback",
            }


def get_ai_service() -> AIOrchestrator:
    return AIOrchestrator()

AIOrchestratorService = AIOrchestrator

def get_ai_orchestrator_service() -> AIOrchestrator:
    return get_ai_service()