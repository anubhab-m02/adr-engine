import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import chroma_client
import config
from ingestion.extract import ExtractionResult
from ingestion.github_client import CommitRef, GitHubError, PullRequestRef
from ingestion.run import run_ingestion
from models import IngestResult

REQUIRED_ENV = {
    "GITHUB_TOKEN": "tok",
    "INDEXED_REPOS": "owner/repo",
    "OLLAMA_EXTRACTION_MODEL": "phi4-mini",
    "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text",
    "GEMINI_API_KEY": "key",
}

DECISION = ExtractionResult(
    is_decision=True, decision="Use Redis", rationale="Shared state", alternatives=["Memcached"]
)
NOT_A_DECISION = ExtractionResult(is_decision=False, decision="", rationale="", alternatives=[])


def _commit(sha="abc123", message="Switch auth to sessions\n\nDropped JWTs.", date="2026-01-01T00:00:00Z"):
    return CommitRef(
        sha=sha,
        message=message,
        author="octocat",
        date=date,
        url=f"https://github.com/owner/repo/commit/{sha}",
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


@pytest.fixture(autouse=True)
def _settings_env(monkeypatch):
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)
    config.get_settings.cache_clear()

    yield

    config.get_settings.cache_clear()


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
        embed_text.return_value = [0.1, 0.2]
        yield {
            "list_commits": list_commits,
            "list_prs": list_prs,
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
    mocks["set_cursor"].assert_called_once()


def test_run_ingestion_skips_non_decision_items(mocks):
    mocks["list_commits"].return_value = [_commit()]
    mocks["list_prs"].return_value = [_pr()]
    mocks["extract_decision"].return_value = NOT_A_DECISION

    result = run_ingestion("owner/repo")

    assert result == IngestResult(repo="owner/repo", fetched=2, extracted=0, skipped=2, stored=0)
    mocks["upsert_units"].assert_not_called()
    mocks["set_cursor"].assert_called_once()


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

    mocks["set_cursor"].assert_called_once_with(
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


def test_run_ingestion_does_not_duplicate_stored_units_on_repeat_run(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()

    from ingestion import store

    with patch("ingestion.run.github_client.list_commits") as list_commits, \
            patch("ingestion.run.github_client.list_prs") as list_prs, \
            patch("ingestion.run.extract.extract_decision") as extract_decision, \
            patch("ingestion.run.embed.embed_text") as embed_text:
        list_commits.return_value = [_commit()]
        list_prs.return_value = []
        extract_decision.return_value = DECISION
        embed_text.return_value = [0.1, 0.2]

        run_ingestion("owner/repo")
        run_ingestion("owner/repo")

    assert store.get_collection().count() == 1

    chroma_client.get_chroma_client.cache_clear()
