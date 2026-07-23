from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import config
from main import app


@pytest.fixture(autouse=True)
def _multi_repo_env(monkeypatch):
    """This router exercises multi-repo fan-out, so override conftest's
    single-repo default (runs after conftest's autouse _settings_env)."""
    monkeypatch.setenv("INDEXED_REPOS", "owner/a,owner/b")
    config.get_settings.cache_clear()

    yield

    config.get_settings.cache_clear()


client = TestClient(app)


def test_ingest_with_repo_returns_202_with_a_job_id_for_just_that_repo():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"):
        start_job.return_value = "job-1"

        response = client.post("/ingest", json={"repo": "owner/a"})

    assert response.status_code == 202
    assert response.json() == {"job_id": "job-1"}
    start_job.assert_called_once_with(["owner/a"])


def test_ingest_with_empty_json_body_starts_all_configured_repos():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"):
        start_job.return_value = "job-2"

        response = client.post("/ingest", json={})

    assert response.status_code == 202
    start_job.assert_called_once_with(["owner/a", "owner/b"])


def test_ingest_with_no_body_at_all_starts_all_configured_repos():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"):
        start_job.return_value = "job-3"

        response = client.post("/ingest")

    assert response.status_code == 202
    start_job.assert_called_once_with(["owner/a", "owner/b"])


def test_ingest_schedules_the_job_as_a_background_task():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job") as run_job:
        start_job.return_value = "job-4"

        client.post("/ingest", json={"repo": "owner/a"})

    run_job.assert_called_once_with("job-4")


def test_ingest_response_matches_ingest_job_response_shape():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"):
        start_job.return_value = "job-5"

        response = client.post("/ingest", json={"repo": "owner/a"})

    assert set(response.json().keys()) == {"job_id"}
