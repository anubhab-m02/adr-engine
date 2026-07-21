from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from ingestion.github_client import GitHubAuthError, GitHubError, RepoSummary, list_repos
from main import app

client = TestClient(app)


def _commits_response(*, last_page: int | None = None, count: int = 1) -> httpx.Response:
    headers = {}
    if last_page is not None:
        headers["Link"] = (
            f'<https://api.github.com/repositories/1/commits?per_page=1&page={last_page}>; '
            f'rel="last"'
        )
    return httpx.Response(200, json=[{"sha": "x"}] * count, headers=headers)


def test_list_repos_returns_typed_repo_summaries(load_fixture):
    repo = load_fixture("github_repo.json")

    def fake_get(url, headers=None, params=None, timeout=None):
        if url.endswith("/commits"):
            return _commits_response(last_page=42)
        return httpx.Response(200, json=[repo])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        repos = list_repos()

    assert repos == [
        RepoSummary(name="octocat/Hello-World", private=False, commit_count_estimate=42)
    ]


def test_list_repos_follows_pagination_to_completion(load_fixture):
    repo = load_fixture("github_repo.json")
    base_url = "https://api.github.com/user/repos"
    page2_url = f"{base_url}?page=2"

    def fake_get(url, headers=None, params=None, timeout=None):
        if url.endswith("/commits"):
            return _commits_response(count=1)
        if url == page2_url:
            return httpx.Response(200, json=[repo])
        return httpx.Response(
            200, json=[repo], headers={"Link": f'<{page2_url}>; rel="next"'}
        )

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get) as mock_get:
        repos = list_repos()

    assert len(repos) == 2
    assert mock_get.call_args_list[0].args[0] == base_url


def test_list_repos_filters_by_query_substring(load_fixture):
    repo = load_fixture("github_repo.json")

    def fake_get(url, headers=None, params=None, timeout=None):
        if url.endswith("/commits"):
            return _commits_response(count=1)
        return httpx.Response(200, json=[repo])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        assert len(list_repos(query="hello")) == 1
        assert list_repos(query="nonexistent") == []


def test_list_repos_raises_github_auth_error_on_401():
    with patch("ingestion.github_client.httpx.get") as mock_get:
        mock_get.return_value = httpx.Response(401, json={"message": "Bad credentials"})

        with pytest.raises(GitHubAuthError) as exc_info:
            list_repos()

    assert exc_info.value.status_code == 401


def test_list_repos_commit_count_falls_back_to_page_length_with_no_last_link(load_fixture):
    repo = load_fixture("github_repo.json")

    def fake_get(url, headers=None, params=None, timeout=None):
        if url.endswith("/commits"):
            return _commits_response(count=1)
        return httpx.Response(200, json=[repo])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        repos = list_repos()

    assert repos[0].commit_count_estimate == 1


def test_list_repos_commit_count_defaults_to_zero_on_empty_repo(load_fixture):
    repo = load_fixture("github_repo.json")

    def fake_get(url, headers=None, params=None, timeout=None):
        if url.endswith("/commits"):
            return httpx.Response(409, json={"message": "Git Repository is empty."})
        return httpx.Response(200, json=[repo])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        repos = list_repos()

    assert repos[0].commit_count_estimate == 0


def test_github_repos_router_returns_repo_list():
    with patch("routers.github.list_repos") as mock_list_repos:
        mock_list_repos.return_value = [
            RepoSummary(name="octocat/Hello-World", private=False, commit_count_estimate=42)
        ]

        response = client.get("/github/repos")

    assert response.status_code == 200
    mock_list_repos.assert_called_once_with(query=None)
    assert response.json() == {
        "repos": [
            {"name": "octocat/Hello-World", "private": False, "commit_count_estimate": 42}
        ]
    }


def test_github_repos_router_passes_query_through():
    with patch("routers.github.list_repos") as mock_list_repos:
        mock_list_repos.return_value = []

        client.get("/github/repos", params={"query": "hello"})

    mock_list_repos.assert_called_once_with(query="hello")


def test_github_repos_router_translates_auth_error_to_401():
    with patch("routers.github.list_repos") as mock_list_repos:
        mock_list_repos.side_effect = GitHubAuthError(401, "Bad credentials")

        response = client.get("/github/repos")

    assert response.status_code == 401
    assert "Bad credentials" in response.json()["detail"]


def test_github_repos_router_translates_other_github_error_to_502():
    with patch("routers.github.list_repos") as mock_list_repos:
        mock_list_repos.side_effect = GitHubError(500, "server error")

        response = client.get("/github/repos")

    assert response.status_code == 502
