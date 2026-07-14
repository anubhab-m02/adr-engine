"""Ollama-based extraction: commit/PR text -> DecisionUnit fields.

Local-only, per ROADMAP.md's privacy stance (no cloud fallback). The
model classifies trivial changes as "not a decision"; malformed output
is retried once with a stricter reinforcement before giving up.
"""

import json

import httpx
from pydantic import BaseModel, ValidationError

from config import get_settings

_PROMPT_TEMPLATE = """You are extracting the engineering decision behind a \
commit or pull request, if any.

Title: {title}

Body:
{body}

Respond with a single JSON object and nothing else.

If this represents a real engineering decision (a deliberate choice with a \
rationale — not a typo fix, formatting change, or routine dependency bump), \
respond with exactly these keys:
{{"is_decision": true, "decision": "<what was decided>", \
"rationale": "<why, or empty string if not inferable>", \
"alternatives": ["<alternative considered>", ...]}}

If this is not a decision, respond with exactly:
{{"is_decision": false, "reason": "<short reason>"}}
"""

_RETRY_REINFORCEMENT = "Return only the JSON object matching the schema above. No other text."


class ExtractionError(Exception):
    """Raised when Ollama can't be reached for extraction."""


class ExtractionResult(BaseModel):
    is_decision: bool
    decision: str
    rationale: str
    alternatives: list[str]


def _build_prompt(title: str, body: str, reinforce: bool = False) -> str:
    prompt = _PROMPT_TEMPLATE.format(title=title, body=body)
    if reinforce:
        prompt = f"{prompt}\n{_RETRY_REINFORCEMENT}"
    return prompt


def _call_ollama(prompt: str) -> str:
    settings = get_settings()
    try:
        response = httpx.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": settings.ollama_extraction_model,
                "prompt": prompt,
                "format": "json",
                "stream": False,
            },
            timeout=settings.ollama_request_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise ExtractionError(f"failed to reach Ollama for extraction: {exc}") from exc

    if response.is_error:
        raise ExtractionError(f"Ollama returned {response.status_code} during extraction")

    return response.json()["response"]


def _parse(raw: str) -> ExtractionResult | None:
    try:
        data = json.loads(raw)
    except ValueError:
        return None

    if data.get("is_decision") is False:
        return ExtractionResult(is_decision=False, decision="", rationale="", alternatives=[])

    try:
        return ExtractionResult(
            is_decision=True,
            decision=data["decision"],
            rationale=data["rationale"],
            alternatives=data["alternatives"],
        )
    except (KeyError, ValidationError):
        return None


def extract_decision(title: str, body: str) -> ExtractionResult | None:
    result = _parse(_call_ollama(_build_prompt(title, body)))
    if result is not None:
        return result

    return _parse(_call_ollama(_build_prompt(title, body, reinforce=True)))
