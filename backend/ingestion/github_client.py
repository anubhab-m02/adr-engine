"""GitHub REST client: typed commit/PR fetching.

Returns typed models only — GitHub's raw JSON schema must not leak past
this module, per ARCHITECTURE.md. Single page only; pagination and
rate-limit handling are handled in a later module.
"""

import httpx
from pydantic import BaseModel

from config import get_settings

GITHUB_API_URL = "https://api.github.com"


class GitHubError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"GitHub API error {status_code}: {message}")


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


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {get_settings().github_token}",
        "Accept": "application/vnd.github+json",
    }


def _get(path: str, params: dict | None = None) -> list | dict:
    response = httpx.get(f"{GITHUB_API_URL}{path}", headers=_headers(), params=params)

    if response.is_error:
        try:
            message = response.json().get("message", response.text)
        except ValueError:
            message = response.text
        raise GitHubError(response.status_code, message)

    return response.json()


def list_commits(repo: str, since: str | None = None) -> list[CommitRef]:
    params = {"since": since} if since else None
    data = _get(f"/repos/{repo}/commits", params=params)

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


def _list_review_comments(repo: str, number: int) -> list[str]:
    data = _get(f"/repos/{repo}/pulls/{number}/comments")
    return [comment["body"] for comment in data]


def list_prs(repo: str, since: str | None = None) -> list[PullRequestRef]:
    # GitHub's PR list endpoint has no server-side "since" filter (unlike
    # /commits), so we sort newest-updated first and filter client-side.
    params = {"state": "closed", "sort": "updated", "direction": "desc"}
    data = _get(f"/repos/{repo}/pulls", params=params)

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
            review_comments=_list_review_comments(repo, item["number"]),
        )
        for item in data
    ]
