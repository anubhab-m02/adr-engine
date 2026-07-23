"""POST /ingest: launches ingestion as a background job and returns
immediately; GET /ingest/status lets the caller poll per-repo progress
for the most recently started job.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter, BackgroundTasks

from config import get_settings
from jobs.ingest_job import get_latest_job, run_job, start_job
from models import IngestJobResponse, IngestRequest, IngestStatusRepo, IngestStatusResponse

router = APIRouter()


@router.post("/ingest", response_model=IngestJobResponse, status_code=202)
def ingest(background_tasks: BackgroundTasks, request: IngestRequest = IngestRequest()) -> IngestJobResponse:
    repos = [request.repo] if request.repo else get_settings().indexed_repos
    job_id = start_job(repos)
    background_tasks.add_task(run_job, job_id)
    return IngestJobResponse(job_id=job_id)


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
