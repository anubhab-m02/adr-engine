import json
from unittest.mock import patch

import httpx
import pytest

import config
from ingestion.extract import ExtractionError, ExtractionResult, extract_decision

REQUIRED_ENV = {
    "GITHUB_TOKEN": "tok",
    "INDEXED_REPOS": "owner/repo",
    "OLLAMA_EXTRACTION_MODEL": "phi4-mini",
    "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text",
    "GEMINI_API_KEY": "key",
}


@pytest.fixture(autouse=True)
def _settings_env(monkeypatch):
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)
    config.get_settings.cache_clear()

    yield

    config.get_settings.cache_clear()


def _ollama_response(text: str) -> httpx.Response:
    return httpx.Response(200, json={"response": text})


def test_extract_decision_returns_result_on_well_formed_json(load_fixture):
    ok = load_fixture("extraction_ok.json")

    with patch("ingestion.extract.httpx.post") as mock_post:
        mock_post.return_value = _ollama_response(json.dumps(ok))

        result = extract_decision(ok["title"], "body text")

    assert result == ExtractionResult(
        is_decision=True,
        decision=ok["decision"],
        rationale=ok["rationale"],
        alternatives=ok["alternatives"],
    )
    assert mock_post.call_count == 1


def test_extract_decision_retries_once_on_malformed_json_then_succeeds(load_fixture):
    malformed = load_fixture("extraction_malformed.txt")
    ok = load_fixture("extraction_ok.json")

    with patch("ingestion.extract.httpx.post") as mock_post:
        mock_post.side_effect = [
            _ollama_response(malformed),
            _ollama_response(json.dumps(ok)),
        ]

        result = extract_decision(ok["title"], "body text")

    assert mock_post.call_count == 2
    assert result == ExtractionResult(
        is_decision=True,
        decision=ok["decision"],
        rationale=ok["rationale"],
        alternatives=ok["alternatives"],
    )


def test_extract_decision_returns_none_after_two_malformed_attempts(load_fixture):
    malformed = load_fixture("extraction_malformed.txt")

    with patch("ingestion.extract.httpx.post") as mock_post:
        mock_post.return_value = _ollama_response(malformed)

        result = extract_decision("Switch auth to session tokens", "body text")

    assert result is None
    assert mock_post.call_count == 2


def test_extract_decision_returns_not_a_decision_for_skip_signal(load_fixture):
    skip = load_fixture("extraction_skip.json")

    with patch("ingestion.extract.httpx.post") as mock_post:
        mock_post.return_value = _ollama_response(json.dumps(skip))

        result = extract_decision("Fix typo in README", "body text")

    assert result == ExtractionResult(
        is_decision=False, decision="", rationale="", alternatives=[]
    )


def test_extract_decision_raises_extraction_error_on_connection_failure():
    with patch("ingestion.extract.httpx.post", side_effect=httpx.ConnectError("refused")):
        with pytest.raises(ExtractionError):
            extract_decision("title", "body text")


def test_extract_decision_raises_extraction_error_on_timeout():
    with patch("ingestion.extract.httpx.post", side_effect=httpx.TimeoutException("timed out")):
        with pytest.raises(ExtractionError):
            extract_decision("title", "body text")


def test_call_ollama_passes_configured_timeout(load_fixture):
    ok = load_fixture("extraction_ok.json")

    with patch("ingestion.extract.httpx.post") as mock_post:
        mock_post.return_value = _ollama_response(json.dumps(ok))

        extract_decision(ok["title"], "body text")

    _, kwargs = mock_post.call_args
    assert kwargs["timeout"] == config.get_settings().ollama_request_timeout_seconds
