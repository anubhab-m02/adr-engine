"""GET/PATCH /config: HTTP surface over config_store (#51).

Talks to `config_store` directly rather than `config.Settings` — the
whole point of this endpoint is to let the UI bootstrap configuration
before any Settings-dependent (required-field) endpoint can run.
Masking and validation are `config_store`'s job; this router only
parses the request, calls the store, and shapes the response.
"""

from fastapi import APIRouter, HTTPException

import config_store
from config import get_settings
from models import ConfigPatchRequest, ConfigResponse

router = APIRouter()


@router.get("/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    return ConfigResponse(**config_store.mask(config_store.load()), chroma_data_dir=config_store.chroma_data_dir())


@router.patch("/config", response_model=ConfigResponse)
def patch_config(patch: ConfigPatchRequest) -> ConfigResponse:
    # chroma_data_dir is env-derived (matches chroma_client.py), never
    # actually persisted through the store, so it's dropped before saving.
    payload = patch.model_dump(exclude_unset=True)
    payload.pop("chroma_data_dir", None)

    try:
        updated = config_store.save(payload)
    except config_store.ConfigValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Other routers (query, repos, github_client...) read config.Settings,
    # which is @lru_cache'd — without this, a saved change here (e.g. a
    # new Gemini key) is invisible to them until process restart. Mirrors
    # DELETE /repos's same cache_clear() after its own config_store write.
    get_settings.cache_clear()

    return ConfigResponse(**config_store.mask(updated), chroma_data_dir=config_store.chroma_data_dir())
