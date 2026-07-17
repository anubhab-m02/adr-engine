"""POST /query: thin wiring from HTTP to retrieval.search + synthesis.answer.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call the
service functions, shape response. No business logic here — the only
addition beyond that is the HTTP-status translation ARCHITECTURE.md's
error-handling section assigns to routers specifically, per
SYSTEM-DESIGN.md's failure-modes table (embedding failure -> 503, Gemini
failure -> 502).
"""

from fastapi import APIRouter, HTTPException

from ingestion.embed import EmbeddingError
from models import QueryRequest, QueryResponse
from retrieval.search import search
from synthesis.answer import SynthesisError, synthesize

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse:
    try:
        results = search(request.question, repos=request.repos)
    except EmbeddingError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        answer, citations = synthesize(request.question, [r.unit for r in results])
    except SynthesisError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return QueryResponse(answer=answer, citations=citations, retrieved_count=len(results))
