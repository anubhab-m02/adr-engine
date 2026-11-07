from types import SimpleNamespace
from unittest.mock import patch

import httpx
import pytest

import config
from synthesis.answer import SynthesisError, synthesis_available, synthesize


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


def test_synthesize_raises_synthesis_error_on_non_json_response_body(make_unit):
    units = [make_unit()]

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, content=b"not json")

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


def _settings(api_key="key", indexed_repos=()):
    return SimpleNamespace(gemini_api_key=api_key, indexed_repos=list(indexed_repos))


def _patch_settings(settings):
    return patch("synthesis.answer.get_settings", return_value=settings)


def _patch_allowed(mapping):
    return patch(
        "synthesis.answer.config_store.get_cloud_synthesis_allowed",
        side_effect=lambda repo: mapping[repo],
    )


def test_synthesis_available_false_without_api_key():
    with _patch_settings(_settings(api_key="")), _patch_allowed({"owner/repo": True}):
        assert synthesis_available(["owner/repo"]) is False


def test_synthesis_available_true_when_all_scoped_repos_allowed():
    with _patch_settings(_settings()), _patch_allowed({"a/one": True, "a/two": True}):
        assert synthesis_available(["a/one", "a/two"]) is True


def test_synthesis_available_false_if_any_scoped_repo_disallows():
    with _patch_settings(_settings()), _patch_allowed({"a/one": True, "a/two": False}):
        assert synthesis_available(["a/one", "a/two"]) is False


def test_synthesis_available_unscoped_checks_every_indexed_repo():
    settings = _settings(indexed_repos=["a/one", "a/two"])
    with _patch_settings(settings), _patch_allowed({"a/one": True, "a/two": False}) as mock_allowed:
        assert synthesis_available(None) is False
        assert {call.args[0] for call in mock_allowed.call_args_list} == {"a/one", "a/two"}

    settings = _settings(indexed_repos=["a/one", "a/two"])
    with _patch_settings(settings), _patch_allowed({"a/one": True, "a/two": True}):
        assert synthesis_available(None) is True


def test_posted_prompt_contains_only_sent_fields(make_unit):
    unit = make_unit(
        author="secret-author-name",
        source_excerpt="secret-excerpt-text",
        files_changed=["secret/path/file.py"],
        alternatives=["secret-alternative"],
    )

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = _gemini_response("ok")
        synthesize("why redis?", [unit])

    prompt = mock_post.call_args.kwargs["json"]["contents"][0]["parts"][0]["text"]
    for value in (unit.id, unit.title, unit.decision, unit.rationale, unit.url):
        assert value in prompt
    for secret in ("secret-author-name", "secret-excerpt-text", "secret/path/file.py", "secret-alternative"):
        assert secret not in prompt
