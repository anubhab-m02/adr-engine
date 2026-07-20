"""GitHub REST client: typed commit/PR fetching.

Returns typed models only — GitHub's raw JSON schema must not leak past
this module, per ARCHITECTURE.md. Follows `Link: rel="next"` pagination
and fails clearly on rate-limit exhaustion rather than hanging a run.
"""

import time
import urllib.parse

import httpx
from pydantic import BaseModel

from config import get_settings

GITHUB_API_URL = "https://api.github.com"


class GitHubError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"GitHub API error {status_code}: {message}")


class GitHubAuthError(GitHubError):
    """Raised when GitHub rejects the stored token as invalid/expired."""


class GitHubRateLimitError(GitHubError):
    """Raised when honoring the rate limit would require waiting longer
    than the configured ceiling."""

    def __init__(self, wait_seconds: float, ceiling_seconds: float):
        self.wait_seconds = wait_seconds
        self.ceiling_seconds = ceiling_seconds
        message = (
            f"rate limit exhausted; reset in {wait_seconds:.0f}s exceeds "
            f"the {ceiling_seconds:.0f}s wait ceiling"
        )
        super().__init__(429, message)


class CommitRef(BaseModel):
    sha: str
    message: str
    author: str
    date: str
    url: str


class PullRequestRef(BaseModel):
    number: int
    title: str
    body: str
    url: str
    author: str
    merged_at: str | None
    review_comments: list[str]


class RepoSummary(BaseModel):
    name: str
    private: bool
    commit_count_estimate: int


class _RateLimiter:
    """Tracks the last response's rate-limit headers across the several
    requests one top-level call (pagination pages, per-PR sub-requests)
    may issue."""

    def __init__(self):
        self._last_response: httpx.Response | None = None

    def check(self) -> None:
        if self._last_response is None:
            return

        remaining = self._last_response.headers.get("x-ratelimit-remaining")
        if remaining is None or int(remaining) > 0:
            return

        reset = self._last_response.headers.get("x-ratelimit-reset")
        if reset is None:
            return

        wait_seconds = max(0.0, float(reset) - time.time())
        ceiling_seconds = get_settings().github_rate_limit_wait_ceiling_seconds
        if wait_seconds > ceiling_seconds:
            raise GitHubRateLimitError(wait_seconds, ceiling_seconds)

        time.sleep(wait_seconds)

    def record(self, response: httpx.Response) -> None:
        self._last_response = response


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {get_settings().github_token}",
        "Accept": "application/vnd.github+json",
    }


def _get(url: str, rate_limiter: _RateLimiter, params: dict | None = None) -> httpx.Response:
    rate_limiter.check()
    try:
        response = httpx.get(
            url,
            headers=_headers(),
            params=params,
            timeout=get_settings().github_request_timeout_seconds,
        )
    except httpx.TimeoutException as exc:
        raise GitHubError(504, f"request to GitHub timed out: {exc}") from exc
    rate_limiter.record(response)

    if response.is_error:
        try:
            message = response.json().get("message", response.text)
        except ValueError:
            message = response.text
        if response.status_code == 401:
            raise GitHubAuthError(response.status_code, message)
        raise GitHubError(response.status_code, message)

    return response


def _paginate(path: str, rate_limiter: _RateLimiter, params: dict | None = None) -> list:
    url = f"{GITHUB_API_URL}{path}"
    items: list = []

    while url:
        response = _get(url, rate_limiter, params=params)
        items.extend(response.json())
        params = None  # the next-page URL already carries the query string
        url = response.links.get("next", {}).get("url")

    return items


def list_commits(repo: str, since: str | None = None) -> list[CommitRef]:
    params = {"since": since} if since else None
    rate_limiter = _RateLimiter()
    data = _paginate(f"/repos/{repo}/commits", rate_limiter, params=params)

    return [
        CommitRef(
            sha=item["sha"],
            message=item["commit"]["message"],
            author=item["commit"]["author"]["name"],
            date=item["commit"]["author"]["date"],
            url=item["html_url"],
        )
        for item in data
    ]


def _list_review_comments(repo: str, number: int, rate_limiter: _RateLimiter) -> list[str]:
    data = _paginate(f"/repos/{repo}/pulls/{number}/comments", rate_limiter)
    return [comment["body"] for comment in data]


def list_prs(repo: str, since: str | None = None) -> list[PullRequestRef]:
    # GitHub's PR list endpoint has no server-side "since" filter (unlike
    # /commits), so we sort newest-updated first and filter client-side.
    params = {"state": "closed", "sort": "updated", "direction": "desc"}
    rate_limiter = _RateLimiter()
    data = _paginate(f"/repos/{repo}/pulls", rate_limiter, params=params)

    if since:
        data = [item for item in data if item["updated_at"] >= since]

    return [
        PullRequestRef(
            number=item["number"],
            title=item["title"],
            body=item["body"] or "",
            url=item["html_url"],
            author=item["user"]["login"],
            merged_at=item["merged_at"],
            review_comments=_list_review_comments(repo, item["number"], rate_limiter),
        )
        for item in data
    ]


def _estimate_commit_count(repo: str, rate_limiter: _RateLimiter) -> int:
    # GitHub has no direct "commit count" field. The documented trick: ask
    # for one commit per page and read the last page number off the Link
    # header, avoiding a full commit fetch just to size a repo picker row.
    try:
        response = _get(
            f"{GITHUB_API_URL}/repos/{repo}/commits",
            rate_limiter,
            params={"per_page": 1},
        )
    except GitHubError:
        return 0

    last_url = response.links.get("last", {}).get("url")
    if last_url is None:
        return len(response.json())

    last_page = urllib.parse.parse_qs(urllib.parse.urlparse(last_url).query)["page"][0]
    return int(last_page)


def list_repos(query: str | None = None) -> list[RepoSummary]:
    rate_limiter = _RateLimiter()
    data = _paginate("/user/repos", rate_limiter, params={"per_page": 100})

    repos = [
        RepoSummary(
            name=item["full_name"],
            private=item["private"],
            commit_count_estimate=_estimate_commit_count(item["full_name"], rate_limiter),
        )
        for item in data
    ]

    if query:
        needle = query.lower()
        repos = [repo for repo in repos if needle in repo.name.lower()]

    return repos
