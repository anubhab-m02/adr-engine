"""Local JSON config store: `{CHROMA_DATA_DIR}/config.json`.

Phase 2's source of truth for GitHub token, Gemini key, indexed repos,
and model settings once the UI manages them via `GET/PATCH /config`
(#52). `config.Settings` layers env-var overrides on top of this store
(env wins when set) so existing `.env` setups keep working.

Reads `CHROMA_DATA_DIR` directly from the environment rather than via
`config.Settings`, matching `chroma_client.py`'s pattern — `config.py`
itself reads this store, so going through `Settings` here would be
circular.
"""

import json
import os
from pathlib import Path

DEFAULT_CHROMA_DATA_DIR = "./chroma_data"

DEFAULTS = {
    "github_token": None,
    "gemini_api_key": None,
    "indexed_repos": [],
    "ollama_host": "http://localhost:11434",
    "ollama_extraction_model": None,
    "ollama_embedding_model": None,
    "gemini_model": "gemini-2.5-flash",
}

_SECRET_FIELDS = {"github_token", "gemini_api_key"}


class ConfigValidationError(ValueError):
    """Raised when a PATCH value fails store-level validation."""


def _config_path() -> Path:
    data_dir = os.getenv("CHROMA_DATA_DIR", DEFAULT_CHROMA_DATA_DIR)
    return Path(data_dir) / "config.json"


def load() -> dict:
    path = _config_path()
    if not path.exists():
        return dict(DEFAULTS)

    stored = json.loads(path.read_text())
    return {**DEFAULTS, **stored}


def save(partial: dict) -> dict:
    """Validate, merge `partial` into the stored config, and persist it."""
    for key, value in partial.items():
        if isinstance(value, str) and not value.strip():
            raise ConfigValidationError(f"{key} must not be empty")

    current = load()
    current.update(partial)

    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(current, indent=2))

    return current


def _mask_value(value: str | None) -> str | None:
    if not value:
        return value
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}…{value[-4:]}"


def mask(raw: dict) -> dict:
    """Return a copy of `raw` with secret fields masked for API responses."""
    return {key: _mask_value(value) if key in _SECRET_FIELDS else value for key, value in raw.items()}
