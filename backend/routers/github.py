"""GET /github/repos: thin wiring from HTTP to github_client.list_repos.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. The only addition beyond that is the
HTTP-status translation ARCHITECTURE.md's error-handling section assigns
to routers specifically.
"""

from fastapi import APIRouter, HTTPException

from ingestion.github_client import GitHubAuthError, GitHubError, list_repos
from models import GitHubReposResponse

router = APIRouter()


@router.get("/github/repos", response_model=GitHubReposResponse)
def github_repos(query: str | None = None) -> GitHubReposResponse:
    try:
        repos = list_repos(query=query)
    except GitHubAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except GitHubError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return GitHubReposResponse(repos=repos)
