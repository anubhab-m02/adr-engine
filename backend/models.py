"""DecisionUnit and API request/response models.

Shared typed vocabulary for ingestion, retrieval, synthesis, and routers.
See docs/SYSTEM-DESIGN.md's data model and API contracts sections.
"""

from typing import Literal

from pydantic import BaseModel


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
