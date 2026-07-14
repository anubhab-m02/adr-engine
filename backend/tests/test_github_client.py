import time
from unittest.mock import patch

import httpx
import pytest

import config
from ingestion.github_client import (
    CommitRef,
    GitHubError,
    GitHubRateLimitError,
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


def test_list_prs_requests_sorted_by_updated_desc(load_fixture):
    pr = load_fixture("github_pr.json")

    def fake_get(url, headers=None, params=None):
        if url.endswith("/comments"):
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=[_pr_list_payload(pr)])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get) as mock_get:
        list_prs("octocat/Hello-World")

    list_call_kwargs = mock_get.call_args_list[0].kwargs
    assert list_call_kwargs["params"] == {
        "state": "closed",
        "sort": "updated",
        "direction": "desc",
    }


def test_list_prs_filters_out_items_updated_before_since(load_fixture):
    pr = load_fixture("github_pr.json")  # updated_at: 2026-03-14T16:05:00Z

    def fake_get(url, headers=None, params=None):
        if url.endswith("/comments"):
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=[_pr_list_payload(pr)])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        prs = list_prs("octocat/Hello-World", since="2026-04-01T00:00:00Z")

    assert prs == []


def test_list_prs_keeps_items_updated_on_or_after_since(load_fixture):
    pr = load_fixture("github_pr.json")  # updated_at: 2026-03-14T16:05:00Z

    def fake_get(url, headers=None, params=None):
        if url.endswith("/comments"):
            return httpx.Response(200, json=[])
        return httpx.Response(200, json=[_pr_list_payload(pr)])

    with patch("ingestion.github_client.httpx.get", side_effect=fake_get):
        prs = list_prs("octocat/Hello-World", since="2026-03-01T00:00:00Z")

    assert len(prs) == 1


def test_list_commits_follows_pagination_link_header(load_fixture):
    commit = load_fixture("github_commit.json")
    base_url = "https://api.github.com/repos/octocat/Hello-World/commits"
    page2_url = f"{base_url}?page=2"
    page3_url = f"{base_url}?page=3"

    responses = [
        httpx.Response(200, json=[commit], headers={"Link": f'<{page2_url}>; rel="next"'}),
        httpx.Response(200, json=[commit], headers={"Link": f'<{page3_url}>; rel="next"'}),
        httpx.Response(200, json=[commit]),
    ]

    with patch("ingestion.github_client.httpx.get", side_effect=responses) as mock_get:
        commits = list_commits("octocat/Hello-World")

    assert len(commits) == 3
    assert mock_get.call_count == 3
    assert mock_get.call_args_list[1].args[0] == page2_url
    assert mock_get.call_args_list[2].args[0] == page3_url


def test_list_commits_raises_rate_limit_error_when_wait_exceeds_ceiling():
    reset_far_future = time.time() + 3600  # well beyond the default 60s ceiling
    exhausted = httpx.Response(
        200,
        json=[],
        headers={
            "Link": (
                '<https://api.github.com/repos/octocat/Hello-World/commits?page=2>; '
                'rel="next"'
            ),
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": str(int(reset_far_future)),
        },
    )

    with patch("ingestion.github_client.httpx.get", return_value=exhausted) as mock_get:
        with pytest.raises(GitHubRateLimitError):
            list_commits("octocat/Hello-World")

    assert mock_get.call_count == 1


def test_get_passes_configured_timeout(load_fixture):
    commit = load_fixture("github_commit.json")

    with patch("ingestion.github_client.httpx.get") as mock_get:
        mock_get.return_value = httpx.Response(200, json=[commit])

        list_commits("octocat/Hello-World")

    _, kwargs = mock_get.call_args
    assert kwargs["timeout"] == config.get_settings().github_request_timeout_seconds


def test_list_commits_raises_github_error_on_timeout():
    with patch("ingestion.github_client.httpx.get", side_effect=httpx.TimeoutException("timed out")):
        with pytest.raises(GitHubError) as exc_info:
            list_commits("octocat/Hello-World")

    assert exc_info.value.status_code == 504


def test_list_commits_waits_and_continues_when_wait_is_within_ceiling(load_fixture):
    commit = load_fixture("github_commit.json")
    reset_soon = time.time() + 5  # well within the default 60s ceiling
    page1 = httpx.Response(
        200,
        json=[commit],
        headers={
            "Link": (
                '<https://api.github.com/repos/octocat/Hello-World/commits?page=2>; '
                'rel="next"'
            ),
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": str(int(reset_soon)),
        },
    )
    page2 = httpx.Response(200, json=[commit])

    with patch("ingestion.github_client.httpx.get", side_effect=[page1, page2]):
        with patch("ingestion.github_client.time.sleep") as mock_sleep:
            commits = list_commits("octocat/Hello-World")

    assert len(commits) == 2
    mock_sleep.assert_called_once()
