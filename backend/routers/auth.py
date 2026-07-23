"""GitHub device-flow HTTP surface: POST /auth/github/device/start,
GET /auth/github/status, DELETE /auth/github.

Per ARCHITECTURE.md's "routers are thin" rule: parse request, call one
service function, shape response. The in-flight device code is kept as
module-level state (mirrors jobs/ingest_job.py's pattern) — a
single-user app has at most one device flow running at a time.
"""

from fastapi import APIRouter, HTTPException

import config_store
from auth.device_flow import DeviceCodeResponse, check_token_once, start_device_flow
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
        if config_store.load()["github_token"]:
            return AuthStatusResponse(state="authorized")
        raise HTTPException(status_code=400, detail="no device flow in progress")

    result = check_token_once(_pending.device_code)
    if result.state != "pending":
        _clear_pending()
    return AuthStatusResponse(state=result.state, login=result.login)


@router.delete("/auth/github")
def disconnect() -> None:
    _clear_pending()
    config_store.save({"github_token": None})


def _clear_pending() -> None:
    global _pending
    _pending = None
