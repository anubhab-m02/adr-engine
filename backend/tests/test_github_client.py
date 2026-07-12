from unittest.mock import patch

import httpx
import pytest

import config
from ingestion.github_client import CommitRef, GitHubError, list_commits

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
