from unittest.mock import patch

import pytest

import chroma_client
import config
from ingestion import diff_filter
from ingestion.extract import ExtractionResult
from ingestion.github_client import CommitRef, GitHubError, PullRequestRef
from ingestion.run import run_ingestion
from models import IngestCounts, IngestResult

DECISION = ExtractionResult(
    is_decision=True, decision="Use Redis", rationale="Shared state", alternatives=["Memcached"]
)
NOT_A_DECISION = ExtractionResult(is_decision=False, decision="", rationale="", alternatives=[])


def _commit(sha="abc123", message="Switch auth to sessions\n\nDropped JWTs.", date="2026-01-01T00:00:00Z",
            files_changed=None):
    return CommitRef(
        sha=sha,
        message=message,
        author="octocat",
        date=date,
        url=f"https://github.com/owner/repo/commit/{sha}",
        files_changed=files_changed or [],
    )


def _pr(number=1, title="Add caching layer", body="Use Redis.", merged_at="2026-02-01T00:00:00Z",
        review_comments=None):
    return PullRequestRef(
        number=number,
        title=title,
        body=body,
        url=f"https://github.com/owner/repo/pull/{number}",
        author="octocat",
        merged_at=merged_at,
        review_comments=review_comments or [],
    )


@pytest.fixture
def mocks():
    with patch("ingestion.run.github_client.list_commits") as list_commits, \
            patch("ingestion.run.github_client.list_prs") as list_prs, \
            patch("ingestion.run.github_client.get_commit_diff") as get_commit_diff, \
            patch("ingestion.run.local_git.list_commits") as local_list_commits, \
            patch("ingestion.run.local_git.get_commit_diff") as local_get_commit_diff, \
            patch("ingestion.run.config_store.get_local_repo_path") as get_local_repo_path, \
            patch("ingestion.run.extract.extract_decision") as extract_decision, \
            patch("ingestion.run.embed.embed_text") as embed_text, \
            patch("ingestion.run.store.get_cursor") as get_cursor, \
            patch("ingestion.run.store.set_cursor") as set_cursor, \
            patch("ingestion.run.store.upsert_units") as upsert_units:
        get_cursor.return_value = {}
        get_local_repo_path.return_value = None
        get_commit_diff.return_value = ""
        embed_text.return_value = [0.1, 0.2]
        yield {
            "list_commits": list_commits,
            "list_prs": list_prs,
            "get_commit_diff": get_commit_diff,
            "local_list_commits": local_list_commits,
            "local_get_commit_diff": local_get_commit_diff,
            "get_local_repo_path": get_local_repo_path,
            "extract_decision": extract_decision,
            "embed_text": embed_text,
            "get_cursor": get_cursor,
            "set_cursor": set_cursor,
            "upsert_units": upsert_units,
        }


def test_run_ingestion_returns_counts_for_a_full_run(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["list_prs"].return_value = [_pr()]
    mocks["extract_decision"].return_value = DECISION

    result = run_ingestion("owner/repo")

    assert result == IngestResult(repo="owner/repo", fetched=2, extracted=2, skipped=0, stored=2)
    assert mocks["upsert_units"].call_count == 2


def test_run_ingestion_skips_non_decision_items(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["list_prs"].return_value = [_pr()]
    mocks["extract_decision"].return_value = NOT_A_DECISION

    result = run_ingestion("owner/repo")

    assert result == IngestResult(repo="owner/repo", fetched=2, extracted=0, skipped=2, stored=0)
    mocks["upsert_units"].assert_not_called()


def test_run_ingestion_skips_malformed_extraction_result(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["list_prs"].return_value = []
    mocks["extract_decision"].return_value = None

    result = run_ingestion("owner/repo")

    assert result.skipped == 1
    assert result.stored == 0


def test_run_ingestion_advances_cursor_to_newest_fetched_dates(mocks):
    mocks["list_commits"].return_value = [
        _commit(sha="a", date="2026-01-01T00:00:00Z"),
        _commit(sha="b", date="2026-01-05T00:00:00Z"),
    ]
    mocks["list_prs"].return_value = [
        _pr(number=1, merged_at="2026-02-01T00:00:00Z"),
        _pr(number=2, merged_at="2026-02-10T00:00:00Z"),
    ]
    mocks["extract_decision"].return_value = NOT_A_DECISION

    run_ingestion("owner/repo")

    mocks["set_cursor"].assert_called_with(
        "owner/repo",
        {"last_commit_date": "2026-01-05T00:00:00Z", "last_pr_updated_at": "2026-02-10T00:00:00Z"},
    )


def test_run_ingestion_passes_cursor_since_to_github_client(mocks):
    mocks["get_cursor"].return_value = {
        "last_commit_date": "2026-01-01T00:00:00Z",
        "last_pr_updated_at": "2026-02-01T00:00:00Z",
    }
    mocks["list_commits"].return_value = []
    mocks["list_prs"].return_value = []

    run_ingestion("owner/repo")

    mocks["list_commits"].assert_called_once_with("owner/repo", since="2026-01-01T00:00:00Z")
    mocks["list_prs"].assert_called_once_with("owner/repo", since="2026-02-01T00:00:00Z")


def test_run_ingestion_raises_and_does_not_advance_cursor_on_github_error(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["list_prs"].side_effect = GitHubError(403, "rate limited")

    with pytest.raises(GitHubError):
        run_ingestion("owner/repo")

    mocks["set_cursor"].assert_not_called()
    mocks["upsert_units"].assert_not_called()


def test_run_ingestion_sets_cursor_after_each_processed_item_not_once_at_the_end(mocks):
    mocks["list_commits"].return_value = [_commit(sha="a"), _commit(sha="b"), _commit(sha="c")]
    mocks["list_prs"].return_value = []
    mocks["extract_decision"].return_value = NOT_A_DECISION

    run_ingestion("owner/repo")

    assert mocks["set_cursor"].call_count == 3


def test_run_ingestion_reports_running_counts_via_on_progress(mocks):
    mocks["list_commits"].return_value = [_commit(sha="a"), _commit(sha="b")]
    mocks["list_prs"].return_value = []
    mocks["extract_decision"].side_effect = [DECISION, NOT_A_DECISION]

    seen = []
    run_ingestion("owner/repo", on_progress=lambda counts: seen.append(counts.model_copy()))

    assert seen == [
        IngestCounts(fetched=1, extracted=1, skipped=0, stored=1),
        IngestCounts(fetched=2, extracted=1, skipped=1, stored=1),
    ]


def test_run_ingestion_threads_files_changed_into_the_stored_unit(mocks):
    mocks["list_commits"].return_value = [_commit(files_changed=["backend/auth.py"])]
    mocks["list_prs"].return_value = []
    mocks["extract_decision"].return_value = DECISION

    run_ingestion("owner/repo")

    ((units, *_), _kwargs) = mocks["upsert_units"].call_args
    assert units[0].files_changed == ["backend/auth.py"]


def test_run_ingestion_passes_the_filtered_diff_to_extract_decision(mocks):
    raw_diff = "diff --git a/backend/auth.py b/backend/auth.py\n+use sessions\n"
    mocks["list_commits"].return_value = [_commit(files_changed=["backend/auth.py"])]
    mocks["list_prs"].return_value = []
    mocks["get_commit_diff"].return_value = raw_diff
    mocks["extract_decision"].return_value = DECISION

    run_ingestion("owner/repo")

    expected_diff = diff_filter.filter_diff(raw_diff)
    _args, kwargs = mocks["extract_decision"].call_args
    assert kwargs["diff"] == expected_diff
    assert expected_diff == raw_diff


def test_run_ingestion_uses_local_git_transport_when_a_local_path_is_configured(mocks):
    mocks["get_local_repo_path"].return_value = "/repos/owner-repo"
    mocks["local_list_commits"].return_value = [_commit()]
    mocks["extract_decision"].return_value = NOT_A_DECISION

    run_ingestion("owner/repo")

    mocks["local_list_commits"].assert_called_once_with("/repos/owner-repo", since=None)
    mocks["list_commits"].assert_not_called()
    mocks["list_prs"].assert_not_called()


def test_run_ingestion_fetches_commit_diffs_via_local_git_when_configured(mocks):
    mocks["get_local_repo_path"].return_value = "/repos/owner-repo"
    mocks["local_list_commits"].return_value = [_commit(sha="deadbeef")]
    mocks["local_get_commit_diff"].return_value = ""
    mocks["extract_decision"].return_value = NOT_A_DECISION

    run_ingestion("owner/repo")

    mocks["local_get_commit_diff"].assert_called_once_with("/repos/owner-repo", "deadbeef")
    mocks["get_commit_diff"].assert_not_called()


def test_run_ingestion_does_not_duplicate_stored_units_on_repeat_run(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()

    from ingestion import store

    with patch("ingestion.run.github_client.list_commits") as list_commits, \
            patch("ingestion.run.github_client.list_prs") as list_prs, \
            patch("ingestion.run.github_client.get_commit_diff") as get_commit_diff, \
            patch("ingestion.run.extract.extract_decision") as extract_decision, \
            patch("ingestion.run.embed.embed_text") as embed_text:
        list_commits.return_value = [_commit()]
        list_prs.return_value = []
        get_commit_diff.return_value = ""
        extract_decision.return_value = DECISION
        embed_text.return_value = [0.1, 0.2]

        run_ingestion("owner/repo")
        run_ingestion("owner/repo")

    assert store.get_collection().count() == 1

    chroma_client.get_chroma_client.cache_clear()
