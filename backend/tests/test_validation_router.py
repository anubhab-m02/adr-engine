from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _tags_response(models: list[str]) -> httpx.Response:
    return httpx.Response(200, json={"models": [{"name": name} for name in models]})


def test_validate_gemini_ok_on_valid_response():
    gemini_response = httpx.Response(
        200, json={"candidates": [{"content": {"parts": [{"text": "OK"}]}}]}
    )

    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = gemini_response

        response = client.post("/config/validate-gemini")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "detail": None}


def test_validate_gemini_reports_auth_error_with_human_readable_detail():
    with patch("synthesis.answer.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(401, json={"error": "unauthorized"})

        response = client.post("/config/validate-gemini")

    body = response.json()
    assert body["ok"] is False
    assert "401" in body["detail"]


def test_validate_gemini_reports_connection_failure():
    with patch("synthesis.answer.httpx.post", side_effect=httpx.ConnectError("refused")):
        response = client.post("/config/validate-gemini")

    body = response.json()
    assert body["ok"] is False
    assert body["detail"]


def test_validate_ollama_ok_when_host_reachable_and_models_present():
    # REQUIRED_ENV configures OLLAMA_EXTRACTION_MODEL=phi4-mini and
    # OLLAMA_EMBEDDING_MODEL=nomic-embed-text.
    with patch("ingestion.ollama_client.httpx.get") as mock_get:
        mock_get.return_value = _tags_response(["phi4-mini:latest", "nomic-embed-text:latest"])

        response = client.post("/config/validate-ollama")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "detail": None}


def test_validate_ollama_reports_unreachable_host():
    with patch("ingestion.ollama_client.httpx.get", side_effect=httpx.ConnectError("refused")):
        response = client.post("/config/validate-ollama")

    body = response.json()
    assert body["ok"] is False
    assert body["detail"]


def test_validate_ollama_reports_missing_model():
    with patch("ingestion.ollama_client.httpx.get") as mock_get:
        mock_get.return_value = _tags_response(["some-other-model:latest"])

        response = client.post("/config/validate-ollama")

    body = response.json()
    assert body["ok"] is False
    assert "phi4-mini" in body["detail"]
    assert "nomic-embed-text" in body["detail"]
