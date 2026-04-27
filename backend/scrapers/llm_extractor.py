"""
LLM-based job data extraction using OpenRouter.
Provides more robust extraction of job details from HTML content.
Uses httpx to call OpenRouter API directly (avoids openai package dependency).
"""
import os
import json
import re
import asyncio
from typing import Optional, List, Dict, Any
import httpx
from .base import JobDetails, JobSalary


class LLMExtractor:
    """Extract job details using LLM via OpenRouter."""

    PROMPT_TEMPLATE_PREFIX = '''Extract structured job info from this text.
Return only valid JSON with exactly these keys:
{"description":"","salary":"","skills":[]}

Rules:
- description: max 320 chars.
- salary: short salary text if present, else "".
- skills: up to 20 technical skills (strings).
- No markdown and no extra keys.

Job text:
'''

    PROMPT_TEMPLATE_SUFFIX = "\n\nJSON only:"

    def __init__(self, api_key: Optional[str] = None, model: str = "nvidia/nemotron-3-super-120b-a12b:free"):
        """
        Initialize LLM extractor.

        Args:
            api_key: OpenRouter API key. If None, reads from OPENROUTER_API_KEY env var.
            model: OpenRouter model to use (default: nvidia/nemotron-3-super-120b-a12b:free)
        """
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError(
                "OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable "
                "or pass api_key parameter."
            )
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)
        self.openrouter_url = "https://openrouter.ai/api/v1/chat/completions"

    async def extract(self, html_or_text: str, max_retries: int = 2) -> Dict[str, Any]:
        """
        Extract job details from HTML or text using LLM.

        Args:
            html_or_text: Job page HTML or cleaned text content
            max_retries: Number of retry attempts on failure

        Returns:
            Dictionary with keys: description, salary, skills
        """
        # Adaptive input windows: if model hits token limit, retry with less input.
        attempt_input_limits = [2800, 1800, 1100, 700]
        # Adaptive output budgets: some models spend many completion tokens before final JSON.
        attempt_output_limits = [320, 700, 1400, 2200]

        for attempt in range(max_retries + 1):
            try:
                input_limit = attempt_input_limits[min(attempt, len(attempt_input_limits) - 1)]
                content = html_or_text[:input_limit] if len(html_or_text) > input_limit else html_or_text
                prompt = self.PROMPT_TEMPLATE_PREFIX + content + self.PROMPT_TEMPLATE_SUFFIX

                output_limit = attempt_output_limits[min(attempt, len(attempt_output_limits) - 1)]

                # Call OpenRouter API directly via httpx
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://smartcareer.app",
                    "X-Title": "SmartCareer",
                }

                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant that extracts job data."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0,
                    "max_tokens": output_limit,
                }

                response = await self.client.post(
                    self.openrouter_url,
                    headers=headers,
                    json=payload,
                )

                if response.status_code != 200:
                    print(
                        f"WARNING: OpenRouter API error {response.status_code}: {response.text[:200]}"
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(0.8 * (attempt + 1))
                        continue
                    return {"description": "", "salary": "", "skills": []}

                response_json = response.json()
                choice = response_json.get("choices", [None])[0] if response_json.get("choices") else None
                finish_reason = getattr(choice, "finish_reason", "unknown") if choice else "unknown"
                usage = response_json.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens")
                completion_tokens = usage.get("completion_tokens")
                total_tokens = usage.get("total_tokens")

                message_content = self._extract_message_text(choice.get("message") if choice else None)
                if not message_content:
                    print(
                        f"WARNING: Empty response from LLM (attempt {attempt+1}, "
                        f"finish_reason={finish_reason}, input_limit={input_limit}, output_limit={output_limit}, "
                        f"prompt_tokens={prompt_tokens}, completion_tokens={completion_tokens}, total_tokens={total_tokens})"
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(0.8 * (attempt + 1))
                        continue
                    return {"description": "", "salary": "", "skills": []}

                llm_output = message_content.strip() if message_content else ""
                print(f"DEBUG: LLM output: {llm_output[:200]}...")

                if not llm_output:
                    print(f"WARNING: Empty LLM response (attempt {attempt+1})")
                    if attempt < max_retries:
                        await asyncio.sleep(1.0 * (attempt + 1))
                        continue
                    return {"description": "", "salary": "", "skills": []}

                # Clean the output (remove markdown code blocks if present)
                # Remove ```json or ``` and ```
                cleaned = re.sub(r'^```json\s*|```$', '', llm_output, flags=re.MULTILINE).strip()

                # Parse JSON
                try:
                    data = json.loads(cleaned)
                except json.JSONDecodeError as e:
                    print(f"WARNING: Failed to parse LLM JSON: {e}")
                    print(f"Raw output: {llm_output}")

                    # If generation hit token limit, attempt to salvage partial JSON fields.
                    if finish_reason == "length":
                        recovered = self._recover_truncated_json(llm_output)
                        has_recovered = bool(recovered.get("description") or recovered.get("salary") or recovered.get("skills"))
                        if has_recovered:
                            print("DEBUG: Recovered partial fields from truncated LLM JSON")
                            data = recovered
                        else:
                            print("DEBUG: Could not recover partial fields from truncated response")
                    else:
                        recovered = None

                    if not recovered:
                        # Try to extract JSON from the output more aggressively
                        # Sometimes the LLM adds extra text before/after
                        json_match = re.search(r'\{.*\}', llm_output, re.DOTALL)
                        if json_match:
                            try:
                                data = json.loads(json_match.group(0))
                                print("DEBUG: Successfully extracted JSON using regex")
                            except json.JSONDecodeError:
                                pass

                    if 'data' not in locals() or not data:
                        if attempt < max_retries:
                            print(f"Retrying LLM extraction (attempt {attempt+2}/{max_retries+1})")
                            await asyncio.sleep(1.0 * (attempt + 1))
                            continue
                        return {"description": "", "salary": "", "skills": []}

                # Validate and normalize fields
                result = {
                    "description": self._safe_get(data, "description", str, default=""),
                    "salary": self._safe_get(data, "salary", str, default=""),
                    "skills": self._safe_get(data, "skills", list, default=[]),
                }

                # Ensure skills is a list of strings
                if not isinstance(result["skills"], list):
                    result["skills"] = []

                # Clean skills
                result["skills"] = [str(s).strip() for s in result["skills"] if s and isinstance(s, (str, int, float))][:20]

                return result

            except Exception as e:
                print(f"ERROR: LLM extraction failed (attempt {attempt + 1}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                return {"description": "", "salary": "", "skills": []}

    def _extract_message_text(self, message: Any) -> str:
        """Best-effort extraction of text from provider-specific message formats."""
        if message is None:
            return ""

        content = message.get("content") if isinstance(message, dict) else getattr(message, "content", None)

        if isinstance(content, str):
            return content

        # Some providers return structured content parts.
        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                    continue

                if isinstance(item, dict):
                    if isinstance(item.get("text"), str):
                        parts.append(item["text"])
                        continue
                    if item.get("type") == "text" and isinstance(item.get("content"), str):
                        parts.append(item["content"])
                        continue

                text_attr = getattr(item, "text", None)
                if isinstance(text_attr, str):
                    parts.append(text_attr)

            return "\n".join(p.strip() for p in parts if p and p.strip())

        return ""

    def _safe_get(self, data: Dict[str, Any], key: str, expected_type: type, default: Any = None) -> Any:
        """Safely get a value from dict with type checking."""
        if key not in data:
            return default
        val = data[key]
        if isinstance(val, expected_type):
            return val
        # Try to convert
        try:
            if expected_type == str:
                return str(val)
            elif expected_type == list:
                return list(val) if hasattr(val, '__iter__') else []
            else:
                return val
        except:
            return default

    def _recover_truncated_json(self, raw_output: str) -> Dict[str, Any]:
        """Recover best-effort fields when JSON is truncated due to token limit."""
        recovered: Dict[str, Any] = {
            "description": "",
            "salary": "",
            "skills": [],
        }

        # Recover description even if closing quote is missing.
        desc_anchor = re.search(r'"description"\s*:\s*"', raw_output)
        if desc_anchor:
            tail = raw_output[desc_anchor.end():]
            stop_markers = [m for m in [tail.find('",\n"salary"'), tail.find('",\n"skills"'), tail.find('",')] if m != -1]
            end_idx = min(stop_markers) if stop_markers else len(tail)
            description = tail[:end_idx].replace("\n", " ").strip().rstrip('" ,\\')
            recovered["description"] = description

        # Recover salary if it is complete.
        salary_match = re.search(r'"salary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', raw_output)
        if salary_match:
            recovered["salary"] = salary_match.group(1).strip()

        # Recover skills when list segment is complete enough.
        skills_match = re.search(r'"skills"\s*:\s*\[(.*?)\]', raw_output, re.DOTALL)
        if skills_match:
            items = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', skills_match.group(1))
            recovered["skills"] = [s.strip() for s in items if s and s.strip()][:20]

        return recovered


async def extract_with_llm(html_or_text: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function to extract job details using LLM.

    Args:
        html_or_text: Job page HTML or text content
        api_key: OpenRouter API key (or set OPENROUTER_API_KEY env var)

    Returns:
        Dictionary with description, salary, and skills
    """
    extractor = LLMExtractor(api_key=api_key)
    return await extractor.extract(html_or_text)
