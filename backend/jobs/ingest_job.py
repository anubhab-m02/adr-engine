"""In-process background ingestion job: one job per `POST /ingest` call,
module-level state read by `GET /ingest/status`. No queue infra, per
SYSTEM-DESIGN.md's ingestion-jobs section — right-sized for a
single-user app. `jobs` may call `ingestion` directly, per
ARCHITECTURE.md's stated exception (it orchestrates it).
"""

import uuid

from pydantic import BaseModel

from ingestion.embed import EmbeddingError
from ingestion.extract import ExtractionError
from ingestion.github_client import GitHubError
from ingestion.run import run_ingestion
from models import IngestCounts, IngestPhase


class RepoJobState(BaseModel):
    repo: str
    phase: IngestPhase = "queued"
    counts: IngestCounts = IngestCounts()
    error: str | None = None


class Job(BaseModel):
    id: str
    active: bool = True
    repos: dict[str, RepoJobState]


_jobs: dict[str, Job] = {}
_latest_job_id: str | None = None


def start_job(repos: list[str]) -> str:
    global _latest_job_id
    job_id = str(uuid.uuid4())
    _jobs[job_id] = Job(id=job_id, repos={repo: RepoJobState(repo=repo) for repo in repos})
    _latest_job_id = job_id
    return job_id


def get_latest_job() -> Job | None:
    """The most recently started job, regardless of whether it's still
    active — `GET /ingest/status` has no job_id param and needs the last
    known state even after completion."""
    return _jobs.get(_latest_job_id) if _latest_job_id else None


def _run_repo(repo: str, state: RepoJobState) -> None:
    """Run ingestion for a single repo, updating `state` in place as it
    progresses. `on_progress` reports counts as each commit/PR is
    processed, so a `GET /ingest/status` poll mid-run sees real numbers
    instead of static zeros."""
    state.phase = "fetching"
    state.error = None
    state.counts = IngestCounts()

    def on_progress(counts: IngestCounts) -> None:
        state.counts = counts

    state.phase = "extracting"
    try:
        result = run_ingestion(repo, on_progress=on_progress)
    except (GitHubError, ExtractionError, EmbeddingError) as exc:
        state.phase = "failed"
        state.error = str(exc)
        return

    state.phase = "done"
    state.counts = IngestCounts(
        fetched=result.fetched,
        extracted=result.extracted,
        skipped=result.skipped,
        stored=result.stored,
    )


def run_job(job_id: str) -> None:
    """Run every repo in the job, isolating failures per repo so one
    repo's boundary error doesn't stop the others' progress (the
    per-item fault-tolerant rule extended across repos, per
    SYSTEM-DESIGN.md's ingestion-jobs section)."""
    job = _jobs[job_id]

    for repo, state in job.repos.items():
        _run_repo(repo, state)

    job.active = False


def retry_job(job_id: str, repo: str) -> None:
    """Re-run a single repo within an existing job, leaving every other
    repo's state untouched."""
    job = _jobs[job_id]
    state = job.repos[repo]

    job.active = True
    _run_repo(repo, state)
    job.active = False
