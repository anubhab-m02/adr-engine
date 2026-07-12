from unittest.mock import patch

import httpx
import pytest

import config
from ingestion.github_client import (
    CommitRef,
    GitHubError,
    PullRequestRef,
    list_commits,
    list_prs,
)

REQUIRED_ENV = {
    "GITHUB_TOKEN": "tok",
    "INDEXED_REPOS": "owner/repo",
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


def test_list_commits_returns_typed_commit_refs(load_fixture):
    commit = load_fixture("github_commit.json")

    with patch("ingestion.github_client.httpx.get") as mock_get:
        mock_get.return_value = httpx.Response(200, json=[commit])

        commits = list_commits("octocat/Hello-World")

    assert commits == [
        CommitRef(
            sha=commit["sha"],
            message=commit["commit"]["message"],
            author=commit["commit"]["author"]["name"],
            date=commit["commit"]["author"]["date"],
            url=commit["html_url"],
        )
    ]


def test_list_commits_passes_since_as_query_param(load_fixture):
    commit = load_fixture("github_commit.json")

    with patch("ingestion.github_client.httpx.get") as mock_get:
        mock_get.return_value = httpx.Response(200, json=[commit])

        list_commits("octocat/Hello-World", since="2026-01-01T00:00:00Z")

    _, kwargs = mock_get.call_args
    assert kwargs["params"] == {"since": "2026-01-01T00:00:00Z"}


def test_list_commits_raises_github_error_on_non_2xx():
    with patch("ingestion.github_client.httpx.get") as mock_get:
        mock_get.return_value = httpx.Response(404, json={"message": "Not Found"})

        with pytest.raises(GitHubError) as exc_info:
            list_commits("octocat/Hello-World")

    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "Not Found"


def _pr_list_payload(pr: dict) -> dict:
    return {key: value for key, value in pr.items() if key != "review_comments"}


def test_list_prs_returns_typed_pull_request_refs_with_review_comments(load_fixture):
    pr = load_fixture("github_pr.json")
    review_comments = pr["review_comments"]

    def fake_get(url, headers=None, params=None):
        if url.endswith("/comments"):
            return httpx.Response(200, json=review_comments)
        return httpx.Response(200, json=[_pr_list_payload(pr)])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        prs = list_prs("octocat/Hello-World")

    assert prs == [
        PullRequestRef(
            number=pr["number"],
            title=pr["title"],
            body=pr["body"],
            url=pr["html_url"],
            author=pr["user"]["login"],
            merged_at=pr["merged_at"],
            review_comments=[comment["body"] for comment in review_comments],
        )
    ]


def test_list_prs_with_no_review_comments_returns_empty_list(load_fixture):
    pr = load_fixture("github_pr.json")

    def fake_get(url, headers=None, params=None):
        if url.endswith("/comments"):
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=[_pr_list_payload(pr)])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        prs = list_prs("octocat/Hello-World")

    assert prs[0].review_comments == []


def test_list_prs_raises_github_error_on_non_2xx():
    with patch("ingestion.github_client.httpx.get") as mock_get:
        mock_get.return_value = httpx.Response(404, json={"message": "Not Found"})

        with pytest.raises(GitHubError) as exc_info:
            list_prs("octocat/Hello-World")

    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "Not Found"
