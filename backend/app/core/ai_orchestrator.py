"""AI orchestrator - full service for LLM operations with Prompt Anatomy."""
import json
import logging
import asyncio
import re
from typing import Any, Dict, List, Optional
import httpx
from backend.app.core.ai.config import AIConfig
from backend.app.core.ai.client import OpenRouterClient
from backend.app.core.config import settings

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
        """Extract valid JSON from content."""
        if not content:
            return "{}"
        
        content = content.strip()
        
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        
        if content.endswith("```"):
            content = content[:-3]
        
        lines = content.split('\n')
        json_start = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('{'):
                json_start = i
                break
        
        if json_start >= 0:
            content = '\n'.join(lines[json_start:])
        
        start = content.find("{")
        end = content.rfind("}")
        
        if start >= 0 and end > start:
            content = content[start:end+1]
        elif start < 0:
            return "{}"
        
        return content.strip()

    @staticmethod
    def try_parse_json(content: str) -> Optional[Dict[str, Any]]:
        """Try to parse JSON."""
        if not content or len(content) < 10:
            return None
        
        try:
            return json.loads(content)
        except:
            pass
        
        start = content.find("{")
        if start >= 0:
            end = content.rfind("}")
            if end > start:
                try:
                    return json.loads(content[start:end+1])
                except:
                    pass
        
        fixed = content.replace("'", '"').replace("`", '"')
        try:
            return json.loads(fixed)
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
        prev_ans: List[str] = []
        for question in previous_questions:
            if isinstance(question, dict):
                selected = question.get("selectedLabel") or question.get("answer") or question.get("label") or question.get("question")
                if isinstance(selected, str) and selected.strip():
                    prev_ans.append(selected.strip())
            elif isinstance(question, str) and question.strip():
                prev_ans.append(question.strip())

        if not prev_ans:
            return "none"

        return ", ".join(prev_ans[-3:])

    @classmethod
    def _build_nova_question_prompt(cls, question_number: int, previous_questions: List[Dict[str, Any]]) -> str:
        blueprint = cls._get_nova_question_blueprint(question_number)
        previous_summary = cls._get_previous_answer_summary(previous_questions)
        options_json = json.dumps(blueprint["options"], ensure_ascii=True)

        return f"""### Instruction
Generate ONE unique Nova Global Profile question for step {question_number} of 10.

### Nova Profile Principles
Nova measures relational intelligence through behavioral style, motivation, cognition, and work preference.
The question must feel distinct from the others and should expand coverage of the current focus instead of repeating a previous topic.

### Question Blueprint
Focus: {blueprint['focus']}
Intent: {blueprint['intent']}
Seed Question: {blueprint['question']}

### Previous Answer Context
{previous_summary}

### Output Rules
- Return only valid JSON
- Use exactly 4 options
- Keep option ids exactly B, V, O, and A
- Keep labels short, human, and non-duplicated
- Keep the question tightly aligned with the blueprint focus
- Avoid repeating the wording or scenario from previous answers

### Required Schema
{{"question":"string","options":[{{"id":"B","label":"string","icon":"string"}},{{"id":"V","label":"string","icon":"string"}},{{"id":"O","label":"string","icon":"string"}},{{"id":"A","label":"string","icon":"string"}}],"questionNumber":{question_number}}}

### Reference Option Set
{options_json}
"""

    @staticmethod
    def _normalize_quiz_payload(parsed: Dict[str, Any], question_number: int) -> Optional[Dict[str, Any]]:
        """Normalize AI quiz payload to a strict, backend-safe shape."""
        if not isinstance(parsed, dict):
            return None

        question = parsed.get("question")
        if not isinstance(question, str) or not question.strip():
            return None

        raw_options = parsed.get("options")
        if not isinstance(raw_options, list) or not raw_options:
            return None

        expected_ids = ["B", "V", "O", "A"]
        default_icons = {
            "B": "analytics",
            "V": "people",
            "O": "flash",
            "A": "globe",
        }
        default_labels = {
            "B": "Review details and plan",
            "V": "Coordinate and support the team",
            "O": "Decide quickly and execute",
            "A": "Explore a creative approach",
        }

        normalized_options: List[Dict[str, str]] = []
        seen_ids = set()
        sequential_labels: List[str] = []

        for idx, option in enumerate(raw_options[:8]):
            option_id = expected_ids[idx] if idx < len(expected_ids) else None
            label = ""
            icon = default_icons.get(option_id or "B", "analytics")

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
                    icon = raw_icon.strip()
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
                        "icon": default_icons[expected_id],
                    }
                    for idx, expected_id in enumerate(expected_ids)
                ]
            # If we have fewer than 4 sequential labels, continue and backfill missing options.

        # Backfill any blank/missing labels defensively for partially truncated model outputs.
        normalized_by_id = {opt["id"]: opt for opt in normalized_options}
        for expected_id in expected_ids:
            if expected_id not in normalized_by_id:
                normalized_by_id[expected_id] = {
                    "id": expected_id,
                    "label": default_labels[expected_id],
                    "icon": default_icons[expected_id],
                }
                continue

            existing_label = normalized_by_id[expected_id].get("label")
            if not isinstance(existing_label, str) or not existing_label.strip():
                normalized_by_id[expected_id]["label"] = default_labels[expected_id]

            existing_icon = normalized_by_id[expected_id].get("icon")
            if not isinstance(existing_icon, str) or not existing_icon.strip():
                normalized_by_id[expected_id]["icon"] = default_icons[expected_id]

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
                temperature=0.7,
                max_tokens=700,
                response_format={"type": "json_object"},
            )
            
            
            content = self._coerce_content_to_text(response["choices"][0]["message"].get("content"))
            json_str = self.extract_json(content)
            parsed = self.try_parse_json(json_str)
            if not parsed:
                parsed = self._recover_quiz_payload_from_partial(content, question_number)

            normalized = self._normalize_quiz_payload(parsed, question_number) if parsed else None
            if normalized:
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
        """Generate a Nova Global Profile report from the full quiz session."""
        try:
            session_payload = self._build_quiz_session_payload(quiz_session)
            session_json = json.dumps(session_payload, ensure_ascii=True, indent=2)
            logger.info(
                'generate_quiz_results: session_items=%s payload_chars=%s',
                len(session_payload),
                len(session_json),
            )

            prompt = f"""### Instruction
Generate a complete Nova Global Profile report from the full quiz session.

### Nova Profile Principles
Nova is a relational-intelligence assessment that integrates behavioral style, motivations, cognition, communication, and career fit.
Use the complete quiz session, not any single answer, to infer the user's consistent work patterns.
Treat the DISC colors as independent indicators and look for the strongest recurring pattern across the whole session.

### Quiz Session Structure
The data below follows the same ordered structure used by QuizScreen.tsx: questionNumber, question, selectedOption, and allOptions.
Analyze the full sequence in order, including the wording of each question and the selected answer.

### Full Quiz Session
{session_json}

### Report Requirements
- Derive the full Nova profile from the entire session
- Reflect the dominant and secondary behavioral style
- Explain the user's natural style and adapted style
- Identify top motivators, demotivators, and values
- Summarize decision style, thinking style, learning style, and communication style
- Describe the best-fit environments, leadership style, watchouts, and future focus
- Provide 3 to 5 development axes that are practical and specific
- Keep the language clear, human, and evidence-based

### Output Format
Return ONLY one valid JSON object in this exact schema:
{{
    "novaProfile": {{
        "headline": "string",
        "professionalIdentity": "string",
        "behavior": {{
            "primaryStyle": "string",
            "secondaryStyle": "string",
            "traits": ["string"],
            "discBlend": "string",
            "discPercentages": {{"red": 0, "yellow": 0, "green": 0, "blue": 0}}
        }},
        "styleComparison": {{
            "naturalStyleSummary": "string",
            "adaptedStyleSummary": "string",
            "adaptationDrivers": ["string"],
            "stressSignals": ["string"]
        }},
        "motivations": {{
            "topMotivators": ["string"],
            "demotivators": ["string"],
            "valuesSummary": "string"
        }},
        "cognition": {{
            "decisionStyle": "string",
            "thinkingStyle": "string",
            "learningStyle": "string",
            "communicationStyle": "string"
        }},
        "careerProjection": {{
            "bestFitEnvironments": ["string"],
            "leadershipStyle": "string",
            "watchouts": ["string"],
            "futureFocus": "string"
        }},
        "recommendedDevelopmentAxes": ["string"]
    }}
}}

### Negative Constraints
- Do not return markdown or code fences
- Do not add extra keys outside novaProfile
- Do not invent unsupported evidence from the session
- Do not collapse the report into a short DISC summary
- Use the session order to ground the interpretation
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
                max_tokens=1800,
                retries=2,
                response_format={"type": "json_object"},
                request_timeout_seconds=90,
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

    async def extract_career_market_intel(self, title: str, snippets: List[str], cache_ttl: int = 86400) -> Optional[Dict[str, Any]]:
        return None

    async def generate_career_explanation(self, career: Dict[str, Any], nova_profile: Dict[str, Any]) -> str:
        return "Good fit based on your profile."

    async def generate_careers_from_profile(self, profile: Dict[str, Any], cache_ttl: int = 21600) -> List[Dict[str, Any]]:
        return []

    async def personalize_roadmap(self, roadmap_id: str, user_profile: Dict[str, Any], cache_ttl: int = 86400) -> Dict[str, Any]:
        return {"phases": [], "message": "Personalization coming soon"}


def get_ai_service() -> AIOrchestrator:
    return AIOrchestrator()

AIOrchestratorService = AIOrchestrator

def get_ai_orchestrator_service() -> AIOrchestrator:
    return get_ai_service()