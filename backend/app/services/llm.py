"""LLM facade: prefer Gemini when GEMINI_API_KEY is set, otherwise Ollama."""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import get_settings
from app.services import gemini_client, ollama_client
from app.services.gemini_client import GeminiError
from app.services.ollama_client import OllamaError

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when both preferred and fallback LLM providers fail (or the only one fails)."""


def chat(
    messages: list[dict[str, str]],
    *,
    format: dict[str, Any] | str | None = None,
    temperature: float = 0.3,
) -> str:
    """Return assistant text from Gemini (if configured) or Ollama.

    Order:
    1. If ``GEMINI_API_KEY`` is set → try Gemini; on failure try Ollama.
    2. Otherwise → Ollama only.
    """
    settings = get_settings()

    if settings.use_gemini:
        try:
            text = gemini_client.chat(messages, format=format, temperature=temperature)
            logger.debug("LLM provider=gemini model=%s", settings.gemini_model)
            return text
        except GeminiError as exc:
            logger.warning("Gemini failed (%s); falling back to Ollama", exc)

    try:
        text = ollama_client.chat(messages, format=format, temperature=temperature)
        logger.debug("LLM provider=ollama model=%s", settings.ollama_model)
        return text
    except OllamaError as exc:
        raise LLMError(str(exc)) from exc
