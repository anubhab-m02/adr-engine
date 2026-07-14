import sys
from pathlib import Path
from unittest.mock import call, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

import config
from main import app
from models import IngestResult

REQUIRED_ENV = {
    "GITHUB_TOKEN": "tok",
    "INDEXED_REPOS": "owner/a,owner/b",
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


client = TestClient(app)


def _result(repo: str) -> IngestResult:
    return IngestResult(repo=repo, fetched=1, extracted=1, skipped=0, stored=1)


def test_ingest_with_repo_runs_just_that_repo():
    with patch("routers.ingest.run_ingestion") as run_ingestion:
        run_ingestion.return_value = _result("owner/a")

        response = client.post("/ingest", json={"repo": "owner/a"})

    assert response.status_code == 200
    run_ingestion.assert_called_once_with("owner/a")
    assert response.json() == {"repos": [_result("owner/a").model_dump()]}


def test_ingest_with_empty_json_body_runs_all_configured_repos():
    with patch("routers.ingest.run_ingestion") as run_ingestion:
        run_ingestion.side_effect = _result

        response = client.post("/ingest", json={})

    assert response.status_code == 200
    assert run_ingestion.call_args_list == [call("owner/a"), call("owner/b")]
    assert [r["repo"] for r in response.json()["repos"]] == ["owner/a", "owner/b"]


def test_ingest_with_no_body_at_all_runs_all_configured_repos():
    with patch("routers.ingest.run_ingestion") as run_ingestion:
        run_ingestion.side_effect = _result

        response = client.post("/ingest")

    assert response.status_code == 200
    assert run_ingestion.call_args_list == [call("owner/a"), call("owner/b")]


def test_ingest_response_matches_ingest_response_shape():
    with patch("routers.ingest.run_ingestion") as run_ingestion:
        run_ingestion.return_value = _result("owner/a")

        response = client.post("/ingest", json={"repo": "owner/a"})

    body = response.json()
    assert set(body.keys()) == {"repos"}
    assert set(body["repos"][0].keys()) == {"repo", "fetched", "extracted", "skipped", "stored"}
