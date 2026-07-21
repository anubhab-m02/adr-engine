"""GET/PATCH /config: HTTP surface over config_store (#51).

Talks to `config_store` directly rather than `config.Settings` — the
whole point of this endpoint is to let the UI bootstrap configuration
before any Settings-dependent (required-field) endpoint can run. Per
ARCHITECTURE.md, secrets are masked in every response.
"""

from fastapi import APIRouter, HTTPException

import config_store
from models import ConfigPatchRequest, ConfigResponse

router = APIRouter()

_SECRET_FIELDS = {"github_token", "gemini_api_key"}


def _mask(value: str | None) -> str | None:
    if not value:
        return value
    if len(value) <= 8:
        return "…"
    return f"{value[:4]}…{value[-4:]}"


def _to_response(raw: dict) -> ConfigResponse:
    masked = {
        key: _mask(value) if key in _SECRET_FIELDS else value for key, value in raw.items()
    }
    return ConfigResponse(**masked)


@router.get("/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    return _to_response(config_store.load())


@router.patch("/config", response_model=ConfigResponse)
def patch_config(patch: ConfigPatchRequest) -> ConfigResponse:
    partial = patch.model_dump(exclude_unset=True)
    for key, value in partial.items():
        if isinstance(value, str) and not value.strip():
            raise HTTPException(status_code=422, detail=f"{key} must not be empty")

    updated = config_store.save(partial)
    return _to_response(updated)
