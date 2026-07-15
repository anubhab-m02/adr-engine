"""GET /repos: thin wiring from HTTP to store.count_units per configured repo.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter

from config import get_settings
from ingestion.store import count_units
from models import RepoInfo, ReposResponse

router = APIRouter()


@router.get("/repos", response_model=ReposResponse)
def repos() -> ReposResponse:
    return ReposResponse(
        repos=[
            RepoInfo(repo=repo, indexed_units=count_units(repo))
            for repo in get_settings().indexed_repos
        ]
    )
