"""GET /setup/state: drives the onboarding gate in App.jsx.

Reads config_store directly rather than config.Settings — same reason
as routers/config.py: this endpoint has to answer truthfully on a
completely fresh install, before Settings' required fields could even
be satisfied.
"""

from fastapi import APIRouter

import config_store
from ingestion.store import count_units
from models import SetupStateResponse

router = APIRouter()


@router.get("/setup/state", response_model=SetupStateResponse)
def setup_state() -> SetupStateResponse:
    cfg = config_store.load()
    indexed_repos = cfg["indexed_repos"]

    return SetupStateResponse(
        github_connected=bool(cfg["github_token"]),
        repos_selected=bool(indexed_repos),
        first_index_done=any(count_units(repo) > 0 for repo in indexed_repos),
        gemini_key_set=bool(cfg["gemini_api_key"]),
    )
