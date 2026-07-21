"""GET/PATCH /config: HTTP surface over config_store (#51).

Talks to `config_store` directly rather than `config.Settings` — the
whole point of this endpoint is to let the UI bootstrap configuration
before any Settings-dependent (required-field) endpoint can run.
Masking and validation are `config_store`'s job; this router only
parses the request, calls the store, and shapes the response.
"""

from fastapi import APIRouter, HTTPException

import config_store
from models import ConfigPatchRequest, ConfigResponse

router = APIRouter()


@router.get("/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    return ConfigResponse(**config_store.mask(config_store.load()))


@router.patch("/config", response_model=ConfigResponse)
def patch_config(patch: ConfigPatchRequest) -> ConfigResponse:
    try:
        updated = config_store.save(patch.model_dump(exclude_unset=True))
    except config_store.ConfigValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ConfigResponse(**config_store.mask(updated))
