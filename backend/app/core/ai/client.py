"""OpenRouter HTTP client using direct API calls."""
import asyncio
import logging
from typing import Any, Dict, List, Optional
import httpx
from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class OpenRouterClient:
    """HTTP client for OpenRouter API."""

    def __init__(self, timeout: Optional[float] = None):
        if timeout is None:
            timeout = settings.openrouter_timeout_seconds
        self.timeout_seconds = timeout
        
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=15.0))
        self.base_url = "https://openrouter.ai/api/v1"
        self.api_key = settings.openrouter_api_key
        self.default_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://smartcareer.app",
            "X-OpenRouter-Title": "SmartCareer",
        }

    async def chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1000,
        response_format: Optional[Dict[str, Any]] = None,
        request_timeout_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Make a chat completion request."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        effective_timeout = request_timeout_seconds or self.timeout_seconds

        try:
            logger.info(
                'OpenRouterClient.chat: start model=%s messages=%s temperature=%s max_tokens=%s timeout=%ss base_url=%s',
                model,
                len(messages),
                temperature,
                max_tokens,
                effective_timeout,
                self.base_url,
            )
            start_time = asyncio.get_running_loop().time()
            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                headers=self.default_headers,
                json=payload,
                timeout=httpx.Timeout(effective_timeout, connect=min(15.0, effective_timeout)),
            )
            duration = asyncio.get_running_loop().time() - start_time
            logger.info(
                'OpenRouterClient.chat: response model=%s status=%s duration=%.2fs content_type=%s content_length=%s',
                model,
                response.status_code,
                duration,
                response.headers.get('content-type'),
                response.headers.get('content-length'),
            )
            
            if response.status_code != 200:
                error_text = response.text[:200] if response.text else "No error details"
                logger.error(
                    'OpenRouterClient.chat: non-200 model=%s status=%s body_preview=%s',
                    model,
                    response.status_code,
                    error_text,
                )
                raise Exception(f"OpenRouter API error {response.status_code}: {error_text}")
            
            payload_json = response.json()
            logger.info(
                'OpenRouterClient.chat: parsed json model=%s keys=%s choices=%s',
                model,
                list(payload_json.keys()) if isinstance(payload_json, dict) else type(payload_json).__name__,
                len(payload_json.get('choices', [])) if isinstance(payload_json, dict) else None,
            )
            return payload_json
        except httpx.TimeoutException as e:
            logger.error(
                'OpenRouterClient.chat: timeout model=%s timeout=%ss error=%r',
                model,
                effective_timeout,
                e,
            )
            raise TimeoutError(f"OpenRouter request timed out after {effective_timeout}s") from e
        except httpx.HTTPError as e:
            logger.error('OpenRouterClient.chat: http error model=%s error=%r', model, e)
            raise Exception(f"OpenRouter request failed: {e}") from e
        except Exception as e:
            logger.error('OpenRouterClient.chat: unexpected error model=%s error_type=%s error=%r', model, type(e).__name__, e)
            if "OpenRouter request" not in str(e):
                raise Exception(f"OpenRouter request failed: {e}") from e
            raise

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()