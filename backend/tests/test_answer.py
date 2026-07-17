from unittest.mock import patch

import httpx
import pytest

import config
from synthesis.answer import SynthesisError, synthesize


def _gemini_response(text: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={"candidates": [{"content": {"parts": [{"text": text}]}}]},
    )


def test_synthesize_resolves_only_cited_units(make_unit):
    units = [
        make_unit(id="owner/repo:pr:1", ref="1"),
        make_unit(id="owner/repo:pr:2", ref="2"),
        make_unit(id="owner/repo:pr:3", ref="3"),
    ]
    answer_text = "Redis was chosen [owner/repo:pr:1], see also [owner/repo:pr:2]."

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = _gemini_response(answer_text)

        answer, citations = synthesize("why redis?", units)

    assert answer == answer_text
    assert citations == [units[0], units[1]]
    assert mock_post.call_count == 1


def test_synthesize_drops_cited_ids_not_in_input_units(make_unit):
    units = [make_unit(id="owner/repo:pr:1", ref="1")]
    answer_text = "Decided per [owner/repo:pr:1] and [owner/repo:pr:99]."

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = _gemini_response(answer_text)

        _, citations = synthesize("why redis?", units)

    assert citations == [units[0]]


def test_synthesize_dedupes_repeated_citations(make_unit):
    units = [make_unit(id="owner/repo:pr:1", ref="1")]
    answer_text = "Per [owner/repo:pr:1], and again [owner/repo:pr:1]."

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = _gemini_response(answer_text)

        _, citations = synthesize("why redis?", units)

    assert citations == [units[0]]


def test_synthesize_empty_units_returns_fixed_answer_without_calling_gemini():
    with patch("synthesis.answer.httpx.post") as mock_post:
        answer, citations = synthesize("why redis?", [])

    assert answer == "Nothing in the indexed history covers this question."
    assert citations == []
    mock_post.assert_not_called()


def test_synthesize_raises_synthesis_error_on_connection_failure(make_unit):
    units = [make_unit()]

    with patch("synthesis.answer.httpx.post", side_effect=httpx.ConnectError("refused")):
        with pytest.raises(SynthesisError):
            synthesize("why redis?", units)


def test_synthesize_raises_synthesis_error_on_timeout(make_unit):
    units = [make_unit()]

    with patch("synthesis.answer.httpx.post", side_effect=httpx.TimeoutException("timed out")):
        with pytest.raises(SynthesisError):
            synthesize("why redis?", units)


def test_synthesize_raises_synthesis_error_on_error_status(make_unit):
    units = [make_unit()]

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(401, json={"error": "unauthorized"})

        with pytest.raises(SynthesisError):
            synthesize("why redis?", units)


def test_synthesize_raises_synthesis_error_on_malformed_response_shape(make_unit):
    units = [make_unit()]

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json={"candidates": []})

        with pytest.raises(SynthesisError):
            synthesize("why redis?", units)


def test_synthesize_passes_configured_timeout_and_api_key(make_unit):
    units = [make_unit()]

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = _gemini_response("no citations here")

        synthesize("why redis?", units)

    _, kwargs = mock_post.call_args
    settings = config.get_settings()
    assert kwargs["timeout"] == settings.gemini_request_timeout_seconds
    assert kwargs["params"] == {"key": settings.gemini_api_key}
