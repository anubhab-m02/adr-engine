"""GitHub device-flow HTTP surface: POST /auth/github/device/start,
GET /auth/github/status, DELETE /auth/github.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. The in-flight device code is kept as
module-level state (mirrors jobs/ingest_job.py's pattern) — a
single-user app has at most one device flow running at a time.
"""

from fastapi import APIRouter, HTTPException

import config_store
from auth.device_flow import DeviceCodeResponse, check_token_once, start_device_flow, verify_stored_token
from models import AuthStatusResponse, DeviceStartResponse

router = APIRouter()

_pending: DeviceCodeResponse | None = None


@router.post("/auth/github/device/start", response_model=DeviceStartResponse)
def start() -> DeviceStartResponse:
    global _pending
    _pending = start_device_flow()
    return DeviceStartResponse(
        user_code=_pending.user_code,
        verification_uri=_pending.verification_uri,
        expires_in=_pending.expires_in,
        interval=_pending.interval,
    )


@router.get("/auth/github/status", response_model=AuthStatusResponse)
def status() -> AuthStatusResponse:
    if _pending is None:
        token = config_store.load()["github_token"]
        if not token:
            raise HTTPException(status_code=400, detail="no device flow in progress")

        user = verify_stored_token(token)
        if user is None:
            # Stored token no longer works (revoked/expired outside the
            # app) — distinct from "never connected", per UI-DESIGN.md's
            # Settings states table.
            return AuthStatusResponse(state="expired")
        return AuthStatusResponse(state="authorized", login=user.login, avatar_url=user.avatar_url)

    result = check_token_once(_pending.device_code)
    if result.state != "pending":
        _clear_pending()
    return AuthStatusResponse(state=result.state, login=result.login, avatar_url=result.avatar_url)


@router.delete("/auth/github")
def disconnect() -> None:
    _clear_pending()
    config_store.save({"github_token": None})


def _clear_pending() -> None:
    global _pending
    _pending = None
