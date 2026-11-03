from unittest.mock import patch

import httpx

from ingestion.ollama_client import _is_pulled, check_ollama

TAGS = {"models": [{"name": "phi4-mini:latest"}, {"name": "nomic-embed-text:latest"}]}


def _check(response=None, side_effect=None):
    with patch("ingestion.ollama_client.httpx.get", side_effect=side_effect) as mock_get:
        if response is not None:
            mock_get.return_value = response
        return check_ollama()


def test_check_ollama_ok_when_models_pulled():
    assert _check(httpx.Response(200, json=TAGS)) == (True, None)


def test_check_ollama_connection_failure():
    ok, error = _check(side_effect=httpx.ConnectError("refused"))
    assert ok is False
    assert "failed to reach Ollama" in error


def test_check_ollama_http_error_status():
    ok, error = _check(httpx.Response(500, json={}))
    assert ok is False
    assert "500" in error


def test_check_ollama_non_json_body():
    ok, error = _check(httpx.Response(200, content=b"not json"))
    assert ok is False
    assert "missing expected 'models'" in error


def test_check_ollama_missing_models_field():
    ok, error = _check(httpx.Response(200, json={"other": []}))
    assert ok is False
    assert "missing expected 'models'" in error


def test_check_ollama_reports_missing_model():
    ok, error = _check(httpx.Response(200, json={"models": [{"name": "phi4-mini:latest"}]}))
    assert ok is False
    assert "nomic-embed-text" in error
    assert "phi4-mini" not in error


def test_is_pulled_matches_tagged_name():
    assert _is_pulled("nomic-embed-text", {"nomic-embed-text:latest"})


def test_is_pulled_exact_match():
    assert _is_pulled("foo:1", {"foo:1"})


def test_is_pulled_rejects_prefix_false_positive():
    assert not _is_pulled("foo", {"foobar:1"})
