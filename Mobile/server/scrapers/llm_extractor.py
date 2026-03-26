"""
LLM-based job data extraction using OpenRouter.
Provides more robust extraction of job details from HTML content.
"""
import os
import json
import re
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from .base import JobDetails, JobSalary


class LLMExtractor:
    """Extract job details using LLM via OpenRouter."""

    # The prompt from your n8n workflow (adapted for Python)
    # Note: Using string concatenation to avoid format() conflicts with JSON braces
    PROMPT_TEMPLATE_PREFIX = '''You are a job data extractor. Your task is to convert the given job posting data into a strict JSON with the following fields (example):

{{
    "description": "You will develop and optimize image analysis algorithms for detection and segmentation of anomalies in medical imaging modalities (CT/MRI).",
    "salary": "45k–60k € / year",
    "skills": [
      "Python",
      "PyTorch",
      "Segmentation",
      "Deep Learning",
      "Computer Vision"
    ]
}}

RULES:
1. Extract information only from the input.
2. If a field is not present, leave it as an empty string "" for strings, or an empty array [] for lists.
3. Job description must be concise (3-4 sentences max) and professional.
4. Salary should include amount, currency, and interval (yearly/monthly/hourly).
5. Skills should be a concise list of relevant technical skills/programming languages/tools.
6. Preserve the field names exactly as shown. Output must be valid JSON ONLY, nothing else:
   - No explanations
   - No markdown
   - No leading or trailing quotes
   - Output MUST be valid JSON.

Here is the job posting HTML or text:
'''
    PROMPT_TEMPLATE_SUFFIX = '''

Return ONLY valid JSON:'''

    def __init__(self, api_key: Optional[str] = None, model: str = "stepfun/step-3.5-flash:free"):
        """
        Initialize LLM extractor.

        Args:
            api_key: OpenRouter API key. If None, reads from OPENROUTER_API_KEY env var.
            model: OpenRouter model to use (default: stepfun/step-3.5-flash:free - free tier)
        """
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError(
                "OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable "
                "or pass api_key parameter."
            )
        self.model = model
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
        )

    async def extract(self, html_or_text: str, max_retries: int = 2) -> Dict[str, Any]:
        """
        Extract job details from HTML or text using LLM.

        Args:
            html_or_text: Job page HTML or cleaned text content
            max_retries: Number of retry attempts on failure

        Returns:
            Dictionary with keys: description, salary, skills
        """
        # Truncate if too long (LLM context limits) - be conservative for free tier
        content = html_or_text[:4000] if len(html_or_text) > 4000 else html_or_text

        prompt = self.PROMPT_TEMPLATE_PREFIX + content + self.PROMPT_TEMPLATE_SUFFIX

        for attempt in range(max_retries + 1):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that extracts job data."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    max_tokens=1000,  # Enough for JSON response with skills array
                )

                # Check if content exists
                message_content = response.choices[0].message.content
                if not message_content:
                    print(f"WARNING: Empty response from LLM (attempt {attempt+1})")
                    if attempt < max_retries:
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

                    # Try to extract JSON from the output more aggressively
                    # Sometimes the LLM adds extra text before/after
                    json_match = re.search(r'\{.*\}', llm_output, re.DOTALL)
                    if json_match:
                        try:
                            data = json.loads(json_match.group(1))
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
                    import asyncio
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                return {"description": "", "salary": "", "skills": []}

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
                return list(val) if iter(val) else []
            else:
                return val
        except:
            return default


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
