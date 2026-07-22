"""In-process background ingestion job: one job per `POST /ingest` call,
module-level state read by `GET /ingest/status`. No queue infra, per
SYSTEM-DESIGN.md's ingestion-jobs section — right-sized for a
single-user app. `jobs` may call `ingestion` directly, per
ARCHITECTURE.md's stated exception (it orchestrates it).
"""

import uuid
from typing import Literal

from pydantic import BaseModel

from ingestion.run import run_ingestion

Phase = Literal["queued", "fetching", "extracting", "embedding", "done", "failed"]


class RepoJobState(BaseModel):
    repo: str
    phase: Phase = "queued"
    counts: dict[str, int] = {"fetched": 0, "extracted": 0, "skipped": 0, "stored": 0}
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


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def get_latest_job() -> Job | None:
    """The most recently started job, regardless of whether it's still
    active — `GET /ingest/status` has no job_id param and needs the last
    known state even after completion."""
    return _jobs.get(_latest_job_id) if _latest_job_id else None


def run_job(job_id: str) -> None:
    """Run every repo in the job, isolating failures per repo so one
    repo's boundary error doesn't stop the others' progress (the
    per-item fault-tolerant rule extended across repos, per
    SYSTEM-DESIGN.md's ingestion-jobs section)."""
    job = _jobs[job_id]

    for repo, state in job.repos.items():
        state.phase = "fetching"
        try:
            result = run_ingestion(repo)
        except Exception as exc:  # per-repo isolation boundary; see docstring
            state.phase = "failed"
            state.error = str(exc)
            continue

        state.phase = "done"
        state.counts = {
            "fetched": result.fetched,
            "extracted": result.extracted,
            "skipped": result.skipped,
            "stored": result.stored,
        }

    job.active = False
