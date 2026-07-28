"""Thin sync client for the local Ollama HTTP API."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class OllamaError(Exception):
    """Raised when Ollama is unreachable or returns an unexpected response."""


def chat(
    messages: list[dict[str, str]],
    *,
    format: dict[str, Any] | str | None = None,
    temperature: float = 0.3,
) -> str:
    """Call Ollama `/api/chat` and return the assistant message content.

    `format` may be `"json"` or a JSON Schema object for structured output.
    """
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if format is not None:
        payload["format"] = format

    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    try:
        with httpx.Client(timeout=settings.ollama_timeout_seconds) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        logger.warning("Ollama request failed: %s", exc)
        raise OllamaError(str(exc)) from exc

    message = data.get("message") or {}
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise OllamaError("Ollama returned an empty message")
    return content.strip()


def is_available() -> bool:
    """Quick health check against the Ollama tags endpoint."""
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        with httpx.Client(timeout=3.0) as client:
            response = client.get(url)
            return response.is_success
    except httpx.HTTPError:
        return False
