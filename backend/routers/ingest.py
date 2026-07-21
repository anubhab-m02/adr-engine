"""POST /ingest: launches ingestion as a background job and returns
immediately; the caller polls GET /ingest/status (next issue) for
per-repo progress.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter, BackgroundTasks

from config import get_settings
from jobs.ingest_job import run_job, start_job
from models import IngestJobResponse, IngestRequest

router = APIRouter()


@router.post("/ingest", response_model=IngestJobResponse, status_code=202)
def ingest(background_tasks: BackgroundTasks, request: IngestRequest = IngestRequest()) -> IngestJobResponse:
    repos = [request.repo] if request.repo else get_settings().indexed_repos
    job_id = start_job(repos)
    background_tasks.add_task(run_job, job_id)
    return IngestJobResponse(job_id=job_id)
