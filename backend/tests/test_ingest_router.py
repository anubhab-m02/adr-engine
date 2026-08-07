from types import SimpleNamespace
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


def test_ingest_with_repos_list_starts_exactly_those_repos():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"):
        start_job.return_value = "job-list"

        response = client.post("/ingest", json={"repos": ["owner/a", "owner/b"]})

    assert response.status_code == 202
    start_job.assert_called_once_with(["owner/a", "owner/b"])


def test_ingest_repos_list_takes_precedence_over_repo():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"):
        start_job.return_value = "job-precedence"

        response = client.post("/ingest", json={"repo": "owner/a", "repos": ["owner/b"]})

    assert response.status_code == 202
    start_job.assert_called_once_with(["owner/b"])


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


def test_ingest_seeds_repo_privacy_for_each_entry():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"), \
            patch("routers.ingest.config_store.set_repo_privacy") as set_repo_privacy:
        start_job.return_value = "job-privacy"

        response = client.post(
            "/ingest",
            json={"repos": ["owner/a", "owner/b"], "repo_privacy": {"owner/a": True, "owner/b": False}},
        )

    assert response.status_code == 202
    set_repo_privacy.assert_any_call("owner/a", True)
    set_repo_privacy.assert_any_call("owner/b", False)
    assert set_repo_privacy.call_count == 2


def test_ingest_without_repo_privacy_does_not_touch_config_store():
    with patch("routers.ingest.start_job") as start_job, patch("routers.ingest.run_job"), \
            patch("routers.ingest.config_store.set_repo_privacy") as set_repo_privacy:
        start_job.return_value = "job-no-privacy"

        client.post("/ingest", json={"repo": "owner/a"})

    set_repo_privacy.assert_not_called()


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


def test_retry_ingest_returns_404_for_a_repo_with_no_known_job():
    with patch("routers.ingest.get_latest_job") as get_latest_job:
        get_latest_job.return_value = None

        response = client.post("/ingest/retry/owner/a")

    assert response.status_code == 404


def test_retry_ingest_returns_404_when_the_repo_is_not_in_the_latest_job():
    job = SimpleNamespace(id="job-1", repos={"owner/a": SimpleNamespace()})
    with patch("routers.ingest.get_latest_job") as get_latest_job:
        get_latest_job.return_value = job

        response = client.post("/ingest/retry/owner/unknown")

    assert response.status_code == 404


def test_retry_ingest_schedules_retry_job_for_a_known_repo():
    job = SimpleNamespace(id="job-1", repos={"owner/a": SimpleNamespace()})
    with patch("routers.ingest.get_latest_job") as get_latest_job, \
            patch("routers.ingest.retry_job") as retry_job:
        get_latest_job.return_value = job

        response = client.post("/ingest/retry/owner/a")

    assert response.status_code == 202
    assert response.json() == {"job_id": "job-1"}
    retry_job.assert_called_once_with("job-1", "owner/a")
