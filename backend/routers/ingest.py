"""POST /ingest: thin wiring from HTTP to ingestion.run.run_ingestion.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter

from config import get_settings
from ingestion.run import run_ingestion
from models import IngestRequest, IngestResponse

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest = IngestRequest()) -> IngestResponse:
    repos = [request.repo] if request.repo else get_settings().indexed_repos
    return IngestResponse(repos=[run_ingestion(repo) for repo in repos])
