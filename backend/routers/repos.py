"""GET /repos: thin wiring from HTTP to store.count_units per configured
repo. DELETE /repos: full-wipe "clear index" action (#84) — clears the
Chroma collection, ingestion cursors, and the configured repo list.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter

import config_store
from config import get_settings
from ingestion.store import clear_all, count_units
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


@router.delete("/repos")
def clear_repos() -> None:
    clear_all()
    config_store.save({"indexed_repos": []})
    get_settings.cache_clear()
