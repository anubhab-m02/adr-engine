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
    "local_repo_paths": {},
    "repo_settings": {},
}

_SECRET_FIELDS = {"github_token", "gemini_api_key"}


class ConfigValidationError(ValueError):
    """Raised when a PATCH value fails store-level validation."""


def chroma_data_dir() -> str:
    return os.getenv("CHROMA_DATA_DIR", DEFAULT_CHROMA_DATA_DIR)


def _config_path() -> Path:
    return Path(chroma_data_dir()) / "config.json"


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


def get_local_repo_path(repo: str) -> str | None:
    return load()["local_repo_paths"].get(repo)


def set_local_repo_path(repo: str, path: str) -> dict:
    paths = dict(load()["local_repo_paths"])
    paths[repo] = path
    return save({"local_repo_paths": paths})


def get_cloud_synthesis_allowed(repo: str) -> bool:
    setting = load()["repo_settings"].get(repo)
    if setting is None:
        return True
    return setting["cloud_synthesis_allowed"]


def set_repo_privacy(repo: str, private: bool) -> dict:
    """Seed `cloud_synthesis_allowed` from GitHub visibility.

    A no-op when the repo already has an explicit override (set via
    `set_cloud_synthesis_allowed`) so re-indexing never clobbers a user's
    choice.
    """
    current = load()
    existing = current["repo_settings"].get(repo)
    if existing is not None and existing["explicit"]:
        return current

    settings = dict(current["repo_settings"])
    settings[repo] = {"cloud_synthesis_allowed": not private, "explicit": False}
    return save({"repo_settings": settings})


def set_cloud_synthesis_allowed(repo: str, allowed: bool) -> dict:
    settings = dict(load()["repo_settings"])
    settings[repo] = {"cloud_synthesis_allowed": allowed, "explicit": True}
    return save({"repo_settings": settings})
