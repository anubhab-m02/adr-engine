from unittest.mock import patch

import pytest

from ingestion.extract import ExtractionResult
from ingestion.github_client import CommitRef, GitHubError
from jobs.ingest_job import get_latest_job, retry_job, run_job, start_job
from models import IngestCounts

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
            patch("ingestion.run.github_client.get_commit_diff") as get_commit_diff, \
            patch("ingestion.run.config_store.get_local_repo_path") as get_local_repo_path, \
            patch("ingestion.run.extract.extract_decision") as extract_decision, \
            patch("ingestion.run.embed.embed_text") as embed_text, \
            patch("ingestion.run.store.get_cursor") as get_cursor, \
            patch("ingestion.run.store.set_cursor") as set_cursor, \
            patch("ingestion.run.store.upsert_units") as upsert_units:
        get_cursor.return_value = {}
        get_local_repo_path.return_value = None
        get_commit_diff.return_value = ""
        list_prs.return_value = []
        embed_text.return_value = [0.1, 0.2]
        yield {
            "list_commits": list_commits,
            "list_prs": list_prs,
            "get_commit_diff": get_commit_diff,
            "extract_decision": extract_decision,
            "get_cursor": get_cursor,
            "set_cursor": set_cursor,
            "upsert_units": upsert_units,
        }


def test_start_job_initializes_every_repo_as_queued():
    start_job(["owner/a", "owner/b"])

    job = get_latest_job()
    assert job.active is True
    assert job.repos["owner/a"].phase == "queued"
    assert job.repos["owner/b"].phase == "queued"


def test_run_job_marks_a_successful_repo_done_with_counts(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["extract_decision"].return_value = DECISION

    job_id = start_job(["owner/repo"])
    run_job(job_id)

    state = get_latest_job().repos["owner/repo"]
    assert state.phase == "done"
    assert state.counts == IngestCounts(fetched=1, extracted=1, skipped=0, stored=1)
    assert state.error is None
    mocks["set_cursor"].assert_called_once()


def test_run_job_passes_through_the_extracting_phase(mocks):
    """The real spec gap the code review flagged: the job used to jump
    straight from `fetching` to `done`/`failed` with no observable
    transition in between, even though `extracting`/`embedding` are part
    of the documented Phase contract."""
    mocks["list_commits"].return_value = [_commit()]
    mocks["extract_decision"].return_value = DECISION

    seen_phases = []

    def record_phase(*args, **kwargs):
        seen_phases.append(get_latest_job().repos["owner/repo"].phase)
        return DECISION

    mocks["extract_decision"].side_effect = record_phase

    job_id = start_job(["owner/repo"])
    run_job(job_id)

    assert "extracting" in seen_phases


def test_run_job_reports_incrementally_growing_counts_mid_run(mocks):
    """Confirmed live: two `GET /ingest/status` calls a few moments apart
    both returned identical zero counts while a run was in progress —
    `state.counts` only ever got set once, after the whole run returned."""
    mocks["list_commits"].return_value = [_commit(sha="a"), _commit(sha="b"), _commit(sha="c")]
    mocks["extract_decision"].return_value = DECISION

    seen_counts = []

    def record_counts(*args, **kwargs):
        seen_counts.append(get_latest_job().repos["owner/repo"].counts.fetched)
        return DECISION

    mocks["extract_decision"].side_effect = record_counts

    job_id = start_job(["owner/repo"])
    run_job(job_id)

    assert seen_counts == [0, 1, 2]
    assert get_latest_job().repos["owner/repo"].counts == IngestCounts(fetched=3, extracted=3, skipped=0, stored=3)


def test_run_job_captures_the_boundary_error_without_stopping_other_repos(mocks):
    def list_commits_side_effect(repo, since=None):
        if repo == "owner/bad":
            raise GitHubError(403, "rate limited")
        return [_commit()]

    mocks["list_commits"].side_effect = list_commits_side_effect
    mocks["extract_decision"].return_value = None

    job_id = start_job(["owner/bad", "owner/good"])
    run_job(job_id)

    job = get_latest_job()
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

    assert get_latest_job().active is False


def test_get_latest_job_returns_the_most_recently_started_job():
    start_job(["owner/first"])
    second_id = start_job(["owner/second"])

    assert get_latest_job().id == second_id


def test_get_latest_job_keeps_returning_the_job_after_it_completes(mocks):
    mocks["list_commits"].return_value = []
    mocks["extract_decision"].return_value = None

    job_id = start_job(["owner/repo"])
    run_job(job_id)

    latest = get_latest_job()
    assert latest.id == job_id
    assert latest.active is False


def test_retry_job_reruns_only_the_specified_repo(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["extract_decision"].return_value = None

    job_id = start_job(["owner/bad", "owner/good"])
    job = get_latest_job()
    job.repos["owner/bad"].phase = "failed"
    job.repos["owner/bad"].error = "rate limited"
    job.repos["owner/good"].phase = "done"
    good_counts = IngestCounts(fetched=1, extracted=0, skipped=1, stored=0)
    job.repos["owner/good"].counts = good_counts

    retry_job(job_id, "owner/bad")

    job = get_latest_job()
    assert job.repos["owner/bad"].phase == "done"
    assert job.repos["owner/bad"].error is None
    assert job.repos["owner/good"].phase == "done"
    assert job.repos["owner/good"].counts == good_counts


def test_retry_job_leaves_the_job_inactive_when_it_finishes(mocks):
    mocks["list_commits"].return_value = []
    mocks["extract_decision"].return_value = None

    job_id = start_job(["owner/repo"])
    run_job(job_id)

    retry_job(job_id, "owner/repo")

    assert get_latest_job().active is False
