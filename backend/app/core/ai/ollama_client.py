"""Ollama Cloud client using the official ollama Python library.

Wraps ollama.AsyncClient for OpenAI-compatible chat completions.
Normalizes Ollama response structure to look exactly like OpenRouter/OpenAI.
"""
import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy import so we don't fail on module load if ollama is not installed yet
try:
    from ollama import AsyncClient
except ImportError:
    AsyncClient = None  # type: ignore


class OllamaClient:
    """Async HTTP client for Ollama Cloud.

    Uses the official ollama.AsyncClient with cloud API key auth.
    Host defaults to https://ollama.com with Bearer token auth.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        host: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        if AsyncClient is None:
            raise ImportError(
                "The 'ollama' package is required. "
                "Install it with: pip install ollama"
            )

        self.api_key = api_key or settings.ollama_api_key
        self.host = host or settings.ollama_host
        self.timeout_seconds = timeout or 90.0
        self.model = settings.ollama_chatbot_model

        # Ollama Cloud requires OLLAMA_API_KEY env var to be set.
        # Set it explicitly if present so the library picks it up.
        if self.api_key and not os.environ.get("OLLAMA_API_KEY"):
            os.environ["OLLAMA_API_KEY"] = self.api_key

        headers: Dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self._client = AsyncClient(host=self.host, headers=headers)

    async def chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1000,
        response_format: Optional[Dict[str, Any]] = None,
        request_timeout_seconds: Optional[float] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Make a chat completion request via Ollama.

        Normalizes the Ollama response into an OpenAI-compatible dict:
        {"choices": [{"message": {"content": "...", "tool_calls": [...]}}]}

        Args:
            model: Model name (e.g., 'deepseek-v4-flash:cloud')
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature
            max_tokens: Max tokens to generate (mapped to num_predict)
            response_format: Optional JSON/format hints
            request_timeout_seconds: Per-request timeout override
            tools: Optional list of tool schemas for native tool calling

        Returns:
            OpenAI-compatible dict
        """
        effective_timeout = request_timeout_seconds or self.timeout_seconds

        logger.info(
            'OllamaClient.chat: start model=%s messages=%s temperature=%s max_tokens=%s timeout=%ss tools_present=%s',
            model,
            len(messages),
            temperature,
            max_tokens,
            effective_timeout,
            bool(tools),
        )

        options: Dict[str, Any] = {
            "temperature": temperature,
            "num_predict": max_tokens,
        }

        # Handle structured output
        fmt: Any = None
        if response_format:
            fmt = response_format

        # Handle tools
        request_tools: Any = None
        if tools:
            request_tools = tools

        try:
            start_time = asyncio.get_running_loop().time()
            response = await asyncio.wait_for(
                self._client.chat(
                    model=model,
                    messages=messages,  # type: ignore[arg-type]
                    options=options,
                    format=fmt,
                    tools=request_tools,
                ),
                timeout=effective_timeout,
            )
            duration = asyncio.get_running_loop().time() - start_time

            # Normalize Ollama response to OpenAI shape
            normalized = self._normalize_response(response)

            logger.info(
                'OllamaClient.chat: end model=%s duration=%.2fs normalized_keys=%s',
                model,
                duration,
                list(normalized.keys()),
            )
            return normalized

        except asyncio.TimeoutError as exc:
            logger.error(
                'OllamaClient.chat: timeout model=%s timeout=%ss',
                model,
                effective_timeout,
            )
            raise TimeoutError(
                f"Ollama request timed out after {effective_timeout}s"
            ) from exc
        except Exception as exc:
            logger.error(
                'OllamaClient.chat: error model=%s error_type=%s error=%r',
                model,
                type(exc).__name__,
                exc,
            )
            raise Exception(f"Ollama request failed: {exc}") from exc

    @staticmethod
    def _normalize_response(response: Any) -> Dict[str, Any]:
        """Normalize Ollama ChatResponse to OpenAI-compatible dict."""
        # Ollama response may be dict or ChatResponse object
        if hasattr(response, "__getitem__"):
            response = dict(response) if callable(getattr(response, "items", None)) else response
        else:
            response = dict(response)

        message = response.get("message", {})
        if hasattr(message, "__getitem__"):
            message = dict(message) if callable(getattr(message, "items", None)) else message
        else:
            message = dict(message)

        content = message.get("content", "")
        tool_calls: List[Dict[str, Any]] = []

        raw_tool_calls = message.get("tool_calls", [])
        if raw_tool_calls:
            for tc in raw_tool_calls:
                if hasattr(tc, "__getitem__"):
                    tc = dict(tc) if callable(getattr(tc, "items", None)) else tc
                else:
                    tc = dict(tc)
                tool_calls.append(tc)

        choices = [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls,
                },
                "finish_reason": response.get("done_reason", "stop"),
            }
        ]

        return {
            "choices": choices,
            "model": response.get("model", "unknown"),
            "created": response.get("created_at", ""),
            "usage": {
                "prompt_tokens": response.get("prompt_eval_count", 0),
                "completion_tokens": response.get("eval_count", 0),
            },
        }

    async def close(self):
        """No-op for AsyncClient (it doesn't expose an explicit close)."""
        pass
