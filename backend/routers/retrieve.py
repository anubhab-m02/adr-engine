"""POST /retrieve: thin wiring from HTTP to retrieval.search.search.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter

from models import RetrieveRequest, RetrieveResponse
from retrieval.search import search

router = APIRouter()


@router.post("/retrieve", response_model=RetrieveResponse)
def retrieve(request: RetrieveRequest) -> RetrieveResponse:
    results = search(request.query, k=request.k, repos=request.repos)
    return RetrieveResponse(results=results)
