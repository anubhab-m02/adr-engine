from unittest.mock import patch

import pytest

from ingestion.extract import ExtractionResult
from ingestion.github_client import CommitRef, GitHubError
from jobs.ingest_job import get_job, run_job, start_job

DECISION = ExtractionResult(is_decision=True, decision="Use Redis", rationale="Shared state", alternatives=[])


def _commit(sha="abc123", date="2026-01-01T00:00:00Z"):
    return CommitRef(
        sha=sha,
        message="Switch to sessions",
        author="octocat",
        date=date,
        url=f"https://github.com/owner/repo/commit/{sha}",
    )


@pytest.fixture
def mocks():
    with patch("ingestion.run.github_client.list_commits") as list_commits, \
            patch("ingestion.run.github_client.list_prs") as list_prs, \
            patch("ingestion.run.extract.extract_decision") as extract_decision, \
            patch("ingestion.run.embed.embed_text") as embed_text, \
            patch("ingestion.run.store.get_cursor") as get_cursor, \
            patch("ingestion.run.store.set_cursor") as set_cursor, \
            patch("ingestion.run.store.upsert_units") as upsert_units:
        get_cursor.return_value = {}
        list_prs.return_value = []
        embed_text.return_value = [0.1, 0.2]
        yield {
            "list_commits": list_commits,
            "list_prs": list_prs,
            "extract_decision": extract_decision,
            "get_cursor": get_cursor,
            "set_cursor": set_cursor,
            "upsert_units": upsert_units,
        }


def test_start_job_initializes_every_repo_as_queued():
    job_id = start_job(["owner/a", "owner/b"])

    job = get_job(job_id)
    assert job.active is True
    assert job.repos["owner/a"].phase == "queued"
    assert job.repos["owner/b"].phase == "queued"


def test_run_job_marks_a_successful_repo_done_with_counts(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["extract_decision"].return_value = DECISION

    job_id = start_job(["owner/repo"])
    run_job(job_id)

    state = get_job(job_id).repos["owner/repo"]
    assert state.phase == "done"
    assert state.counts == {"fetched": 1, "extracted": 1, "skipped": 0, "stored": 1}
    assert state.error is None
    mocks["set_cursor"].assert_called_once()


def test_run_job_captures_the_boundary_error_without_stopping_other_repos(mocks):
    def list_commits_side_effect(repo, since=None):
        if repo == "owner/bad":
            raise GitHubError(403, "rate limited")
        return [_commit()]

    mocks["list_commits"].side_effect = list_commits_side_effect
    mocks["extract_decision"].return_value = None

    job_id = start_job(["owner/bad", "owner/good"])
    run_job(job_id)

    job = get_job(job_id)
    assert job.repos["owner/bad"].phase == "failed"
    assert "rate limited" in job.repos["owner/bad"].error
    assert job.repos["owner/good"].phase == "done"


def test_run_job_only_writes_the_cursor_for_the_successful_repo(mocks):
    def list_commits_side_effect(repo, since=None):
        if repo == "owner/bad":
            raise GitHubError(403, "rate limited")
        return [_commit()]

    mocks["list_commits"].side_effect = list_commits_side_effect
    mocks["extract_decision"].return_value = None

    job_id = start_job(["owner/bad", "owner/good"])
    run_job(job_id)

    mocks["set_cursor"].assert_called_once_with("owner/good", {"last_commit_date": "2026-01-01T00:00:00Z"})


def test_run_job_marks_the_job_inactive_once_every_repo_finishes(mocks):
    mocks["list_commits"].return_value = []
    mocks["extract_decision"].return_value = None

    job_id = start_job(["owner/repo"])
    run_job(job_id)

    assert get_job(job_id).active is False
