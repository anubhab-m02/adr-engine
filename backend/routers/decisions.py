"""GET /decisions: thin wiring from HTTP to store.list_units.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter

from ingestion.store import count_units_by_path, list_units
from models import DecisionsByPathResponse, DecisionsResponse

router = APIRouter()


@router.get("/decisions", response_model=DecisionsResponse)
def decisions(
    repo: str,
    since: str | None = None,
    until: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> DecisionsResponse:
    units, total = list_units(repo, since=since, until=until, limit=limit, offset=(page - 1) * limit)
    return DecisionsResponse(units=units, total=total, page=page, limit=limit)


@router.get("/decisions/by-path", response_model=DecisionsByPathResponse)
def decisions_by_path(repo: str) -> DecisionsByPathResponse:
    return DecisionsByPathResponse(paths=count_units_by_path(repo))
