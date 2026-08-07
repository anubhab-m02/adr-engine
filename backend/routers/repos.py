"""GET /repos: thin wiring from HTTP to store.count_units per configured
repo, plus each repo's cloud_synthesis_allowed flag. PATCH /repos/{repo}:
overrides that flag. DELETE /repos: full-wipe "clear index" action (#84)
— clears the Chroma collection, ingestion cursors, and the configured
repo list.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter

import config_store
from config import get_settings
from ingestion.store import clear_all, count_units
from models import RepoInfo, RepoPrivacyPatchRequest, ReposResponse

router = APIRouter()


@router.get("/repos", response_model=ReposResponse)
def repos() -> ReposResponse:
    return ReposResponse(
        repos=[
            RepoInfo(
                repo=repo,
                indexed_units=count_units(repo),
                cloud_synthesis_allowed=config_store.get_cloud_synthesis_allowed(repo),
            )
            for repo in get_settings().indexed_repos
        ]
    )


@router.patch("/repos/{repo:path}", response_model=RepoInfo)
def patch_repo(repo: str, request: RepoPrivacyPatchRequest) -> RepoInfo:
    config_store.set_cloud_synthesis_allowed(repo, request.cloud_synthesis_allowed)
    return RepoInfo(
        repo=repo,
        indexed_units=count_units(repo),
        cloud_synthesis_allowed=request.cloud_synthesis_allowed,
    )


@router.delete("/repos")
def clear_repos() -> None:
    clear_all()
    config_store.save({"indexed_repos": []})
    get_settings.cache_clear()
