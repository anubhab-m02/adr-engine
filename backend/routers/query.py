"""POST /query: thin wiring from HTTP to retrieval.search + synthesis.answer.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call the
service functions, shape response. No business logic here.
"""

from fastapi import APIRouter

from models import QueryRequest, QueryResponse
from retrieval.search import search
from synthesis.answer import synthesize

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse:
    results = search(request.question, repos=request.repos)
    answer, citations = synthesize(request.question, [r.unit for r in results])
    return QueryResponse(answer=answer, citations=citations, retrieved_count=len(results))
