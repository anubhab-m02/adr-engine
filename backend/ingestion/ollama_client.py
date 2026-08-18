"""Ollama reachability + model-presence check.

Separate from embed.py/extract.py (which perform real embedding/extraction
calls) — this only lists what Ollama has pulled, via GET /api/tags, so the
validation router can confirm the configured host and models are live.
"""

import httpx

from config import get_settings


def check_ollama() -> tuple[bool, str | None]:
    settings = get_settings()

    try:
        response = httpx.get(
            f"{settings.ollama_host}/api/tags",
            timeout=settings.ollama_request_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        return False, f"failed to reach Ollama at {settings.ollama_host}: {exc}"

    if response.is_error:
        return False, f"Ollama returned {response.status_code} for /api/tags"

    try:
        available = {model["name"] for model in response.json()["models"]}
    except (ValueError, KeyError, TypeError):
        return False, "Ollama /api/tags response missing expected 'models' field"

    missing = [
        model
        for model in (settings.ollama_extraction_model, settings.ollama_embedding_model)
        if not _is_pulled(model, available)
    ]
    if missing:
        return False, f"model(s) not found on Ollama: {', '.join(missing)}"

    return True, None


def _is_pulled(model: str, available: set[str]) -> bool:
    return model in available or any(name.startswith(f"{model}:") for name in available)
