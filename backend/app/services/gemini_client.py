"""Google Gemini Generative Language API client (HTTP)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiError(Exception):
    """Raised when Gemini is unreachable or returns an unexpected response."""


def _split_messages(
    messages: list[dict[str, str]],
) -> tuple[str | None, list[dict[str, Any]]]:
    """Map OpenAI-style messages to Gemini system_instruction + contents."""
    system_parts: list[str] = []
    contents: list[dict[str, Any]] = []

    for msg in messages:
        role = (msg.get("role") or "user").lower()
        content = msg.get("content") or ""
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
            continue
        gemini_role = "model" if role in {"assistant", "model"} else "user"
        # Gemini requires alternating user/model; merge consecutive same roles.
        if contents and contents[-1]["role"] == gemini_role:
            contents[-1]["parts"][0]["text"] += "\n\n" + content
        else:
            contents.append({"role": gemini_role, "parts": [{"text": content}]})

    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, contents


def _simplify_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Strip JSON Schema keys Gemini responseSchema does not accept."""
    allowed = {"type", "properties", "required", "items", "enum", "description"}
    out: dict[str, Any] = {}
    for key, value in schema.items():
        if key not in allowed:
            continue
        if key == "properties" and isinstance(value, dict):
            out[key] = {k: _simplify_schema(v) if isinstance(v, dict) else v for k, v in value.items()}
        elif key == "items" and isinstance(value, dict):
            out[key] = _simplify_schema(value)
        else:
            out[key] = value
    return out


def chat(
    messages: list[dict[str, str]],
    *,
    format: dict[str, Any] | str | None = None,
    temperature: float = 0.3,
) -> str:
    """Call Gemini generateContent and return the assistant text."""
    settings = get_settings()
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is not configured")

    system_instruction, contents = _split_messages(messages)
    if not contents:
        raise GeminiError("No user/model messages to send to Gemini")

    generation_config: dict[str, Any] = {"temperature": temperature}
    if format is not None:
        generation_config["responseMimeType"] = "application/json"
        if isinstance(format, dict):
            generation_config["responseSchema"] = _simplify_schema(format)

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": generation_config,
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    model = settings.gemini_model.strip() or "gemini-2.0-flash"
    url = f"{GEMINI_BASE}/models/{model}:generateContent"
    try:
        with httpx.Client(timeout=settings.gemini_timeout_seconds) as client:
            response = client.post(url, params={"key": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        detail = ""
        if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
            detail = f" — {exc.response.text[:300]}"
        logger.warning("Gemini request failed: %s%s", exc, detail)
        raise GeminiError(str(exc)) from exc

    try:
        parts = data["candidates"][0]["content"]["parts"]
        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        content = "\n".join(t for t in texts if t).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("Gemini returned an unexpected payload") from exc

    if not content:
        raise GeminiError("Gemini returned an empty message")
    return content
