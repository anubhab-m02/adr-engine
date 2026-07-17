"""Gemini-based synthesis: retrieved DecisionUnits -> cited answer.

Cloud call, per ROADMAP.md's privacy stance: only the retrieved top-k units
are ever sent here, never the full corpus. Citations are resolved
server-side against the input units — the model is never trusted to echo
unit data, only to cite an id.
"""

import re

import httpx

from config import get_settings
from models import DecisionUnit

_NO_COVERAGE_ANSWER = "Nothing in the indexed history covers this question."

_PROMPT_TEMPLATE = """You are answering a question about why an engineering \
decision was made, using only the decisions listed below.

Question: {question}

Decisions:
{units}

Answer the question using only the information in these decisions. Cite \
each decision you use inline by its id in square brackets, e.g. [{example_id}]. \
If the decisions above don't cover the question, respond with exactly: \
"{no_coverage}"
"""

_CITATION_PATTERN = re.compile(r"\[([^\[\]]+)\]")


class SynthesisError(Exception):
    """Raised when Gemini can't be reached, or returns an error, for synthesis."""


def _format_unit(unit: DecisionUnit) -> str:
    return (
        f"id: {unit.id}\n"
        f"title: {unit.title}\n"
        f"decision: {unit.decision}\n"
        f"rationale: {unit.rationale}\n"
        f"url: {unit.url}"
    )


def _build_prompt(question: str, units: list[DecisionUnit]) -> str:
    return _PROMPT_TEMPLATE.format(
        question=question,
        units="\n\n".join(_format_unit(unit) for unit in units),
        example_id=units[0].id,
        no_coverage=_NO_COVERAGE_ANSWER,
    )


def _call_gemini(prompt: str) -> str:
    settings = get_settings()
    try:
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_model}:generateContent",
            params={"key": settings.gemini_api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=settings.gemini_request_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise SynthesisError(f"failed to reach Gemini for synthesis: {exc}") from exc

    if response.is_error:
        raise SynthesisError(f"Gemini returned {response.status_code} during synthesis")

    try:
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, ValueError) as exc:
        # ValueError also catches json.JSONDecodeError from response.json()
        # itself, e.g. a non-JSON 200 body.
        raise SynthesisError("Gemini response missing expected candidate text") from exc


def _resolve_citations(answer: str, units: list[DecisionUnit]) -> list[DecisionUnit]:
    units_by_id = {unit.id: unit for unit in units}
    cited_ids = dict.fromkeys(_CITATION_PATTERN.findall(answer))

    return [units_by_id[unit_id] for unit_id in cited_ids if unit_id in units_by_id]


def synthesize(question: str, units: list[DecisionUnit]) -> tuple[str, list[DecisionUnit]]:
    if not units:
        return _NO_COVERAGE_ANSWER, []

    answer = _call_gemini(_build_prompt(question, units))
    return answer, _resolve_citations(answer, units)
