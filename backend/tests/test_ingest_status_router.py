from unittest.mock import patch

from fastapi.testclient import TestClient

from jobs.ingest_job import Job, RepoJobState
from main import app

client = TestClient(app)


def test_status_with_no_job_ever_started_is_inactive_with_no_repos():
    with patch("routers.ingest.get_latest_job", return_value=None):
        response = client.get("/ingest/status")

    assert response.status_code == 200
    assert response.json() == {"active": False, "repos": []}


def test_status_during_a_run_matches_the_job_state_exactly():
    job = Job(
        id="job-1",
        active=True,
        repos={
            "owner/a": RepoJobState(
                repo="owner/a",
                phase="extracting",
                counts={"fetched": 5, "extracted": 2, "skipped": 1, "stored": 0},
            )
        },
    )

    with patch("routers.ingest.get_latest_job", return_value=job):
        response = client.get("/ingest/status")

    assert response.status_code == 200
    assert response.json() == {
        "active": True,
        "repos": [
            {
                "repo": "owner/a",
                "phase": "extracting",
                "counts": {"fetched": 5, "extracted": 2, "skipped": 1, "stored": 0},
                "error": None,
            }
        ],
    }


def test_status_after_completion_flips_active_false_and_keeps_final_counts():
    job = Job(
        id="job-2",
        active=False,
        repos={
            "owner/a": RepoJobState(
                repo="owner/a",
                phase="done",
                counts={"fetched": 3, "extracted": 3, "skipped": 0, "stored": 3},
            )
        },
    )

    with patch("routers.ingest.get_latest_job", return_value=job):
        response = client.get("/ingest/status")

    body = response.json()
    assert body["active"] is False
    assert body["repos"][0]["phase"] == "done"
    assert body["repos"][0]["counts"] == {"fetched": 3, "extracted": 3, "skipped": 0, "stored": 3}


def test_status_surfaces_a_per_repo_error_on_failure():
    job = Job(
        id="job-3",
        active=False,
        repos={"owner/bad": RepoJobState(repo="owner/bad", phase="failed", error="rate limited")},
    )

    with patch("routers.ingest.get_latest_job", return_value=job):
        response = client.get("/ingest/status")

    repo_status = response.json()["repos"][0]
    assert repo_status["phase"] == "failed"
    assert repo_status["error"] == "rate limited"


def test_status_reflects_multiple_repos_in_the_job():
    job = Job(
        id="job-4",
        active=True,
        repos={
            "owner/a": RepoJobState(repo="owner/a", phase="done"),
            "owner/b": RepoJobState(repo="owner/b", phase="fetching"),
        },
    )

    with patch("routers.ingest.get_latest_job", return_value=job):
        response = client.get("/ingest/status")

    repos_by_name = {r["repo"]: r for r in response.json()["repos"]}
    assert repos_by_name["owner/a"]["phase"] == "done"
    assert repos_by_name["owner/b"]["phase"] == "fetching"
