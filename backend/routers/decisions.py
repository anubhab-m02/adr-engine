"""GET /decisions: thin wiring from HTTP to store.list_units.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. No business logic here.
"""

from fastapi import APIRouter

from ingestion.store import list_units
from models import DecisionsResponse

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
