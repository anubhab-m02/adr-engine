"""DecisionUnit and API request/response models.

Shared typed vocabulary for ingestion, retrieval, synthesis, and routers.
See docs/SYSTEM-DESIGN.md's data model and API contracts sections.
"""

from typing import Literal

from pydantic import BaseModel

from ingestion.github_client import RepoSummary


class DecisionUnit(BaseModel):
    id: str
    repo: str
    kind: Literal["commit", "pr"]
    ref: str
    url: str
    author: str
    date: str
    title: str
    decision: str
    rationale: str
    alternatives: list[str]
    source_excerpt: str


class IngestRequest(BaseModel):
    repo: str | None = None


class IngestResult(BaseModel):
    repo: str
    fetched: int
    extracted: int
    skipped: int
    stored: int


class IngestResponse(BaseModel):
    repos: list[IngestResult]


class IngestJobResponse(BaseModel):
    job_id: str


IngestPhase = Literal["queued", "fetching", "extracting", "embedding", "done", "failed"]


class IngestCounts(BaseModel):
    fetched: int = 0
    extracted: int = 0
    skipped: int = 0
    stored: int = 0


class IngestStatusRepo(BaseModel):
    repo: str
    phase: IngestPhase
    counts: IngestCounts
    error: str | None = None


class IngestStatusResponse(BaseModel):
    active: bool
    repos: list[IngestStatusRepo]


class RetrieveRequest(BaseModel):
    query: str
    k: int = 5
    repos: list[str] | None = None


class RetrieveResult(BaseModel):
    unit: DecisionUnit
    score: float


class RetrieveResponse(BaseModel):
    results: list[RetrieveResult]


class QueryRequest(BaseModel):
    question: str
    repos: list[str] | None = None


class QueryResponse(BaseModel):
    answer: str
    citations: list[DecisionUnit]
    retrieved_count: int


class RepoInfo(BaseModel):
    repo: str
    indexed_units: int


class ReposResponse(BaseModel):
    repos: list[RepoInfo]


class GitHubReposResponse(BaseModel):
    repos: list[RepoSummary]


class ConfigResponse(BaseModel):
    github_token: str | None = None
    gemini_api_key: str | None = None
    indexed_repos: list[str] = []
    ollama_host: str
    ollama_extraction_model: str | None = None
    ollama_embedding_model: str | None = None
    gemini_model: str


class ConfigPatchRequest(ConfigResponse):
    """Same shape as ConfigResponse, but every field is optional (a PATCH
    only ever sends the fields being changed)."""

    ollama_host: str | None = None
    gemini_model: str | None = None


class DeviceStartResponse(BaseModel):
    user_code: str
    verification_uri: str
    expires_in: int
    interval: int


class AuthStatusResponse(BaseModel):
    state: Literal["pending", "authorized", "expired", "denied"]
    login: str | None = None


class SetupStateResponse(BaseModel):
    github_connected: bool
    repos_selected: bool
    first_index_done: bool
    gemini_key_set: bool
