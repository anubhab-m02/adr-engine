"""POST /ingest: launches ingestion as a background job and returns
immediately; GET /ingest/status lets the caller poll per-repo progress
for the most recently started job; POST /ingest/retry/{repo} re-runs a
single repo within that job without restarting the others.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException

import config_store
from config import get_settings
from jobs.ingest_job import get_latest_job, retry_job, run_job, start_job
from models import IngestJobResponse, IngestRequest, IngestStatusRepo, IngestStatusResponse

router = APIRouter()


@router.post("/ingest", response_model=IngestJobResponse, status_code=202)
def ingest(background_tasks: BackgroundTasks, request: IngestRequest = IngestRequest()) -> IngestJobResponse:
    repos = request.repos or ([request.repo] if request.repo else None) or get_settings().indexed_repos
    config_store.seed_repo_privacy(request.repo_privacy or {})
    job_id = start_job(repos)
    background_tasks.add_task(run_job, job_id)
    return IngestJobResponse(job_id=job_id)


@router.post("/ingest/retry/{repo:path}", response_model=IngestJobResponse, status_code=202)
def retry_ingest(repo: str, background_tasks: BackgroundTasks) -> IngestJobResponse:
    job = get_latest_job()
    if job is None or repo not in job.repos:
        raise HTTPException(status_code=404, detail=f"no known job for repo {repo}")

    background_tasks.add_task(retry_job, job.id, repo)
    return IngestJobResponse(job_id=job.id)


@router.get("/ingest/status", response_model=IngestStatusResponse)
def ingest_status() -> IngestStatusResponse:
    job = get_latest_job()
    if job is None:
        return IngestStatusResponse(active=False, repos=[])

    return IngestStatusResponse(
        active=job.active,
        repos=[
            IngestStatusRepo(repo=state.repo, phase=state.phase, counts=state.counts, error=state.error)
            for state in job.repos.values()
        ],
    )
