"""Application settings.

The only place environment variables are read directly. Every other
module imports `get_settings()` instead of touching `os.environ` or
`config_store` itself. Values not provided by env/`.env` fall back to
the `config_store` (Phase 2) — env always wins when both are set.
"""

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

import config_store


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    github_token: str
    indexed_repos: Annotated[list[str], NoDecode]
    ollama_host: str = "http://localhost:11434"
    ollama_extraction_model: str
    ollama_embedding_model: str
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    chroma_data_dir: str = "./chroma_data"
    github_rate_limit_wait_ceiling_seconds: float = 60
    github_request_timeout_seconds: float = 10
    ollama_request_timeout_seconds: float = 60
    gemini_request_timeout_seconds: float = 30

    @model_validator(mode="before")
    @classmethod
    def _fill_from_config_store(cls, data: dict) -> dict:
        if not isinstance(data, dict):
            return data

        stored = config_store.load()
        for key, value in stored.items():
            # `data.get(key) == ""` (not just `key not in data`) so an env
            # var that's declared but empty (e.g. .env's `GEMINI_API_KEY=`
            # with nothing after the `=`) still falls back to the store
            # instead of permanently shadowing it with "". An empty list
            # (e.g. indexed_repos cleared via DELETE /repos) is a real,
            # deliberate value and must NOT be treated the same way.
            if value is not None and (key not in data or data[key] == ""):
                data[key] = value
        return data

    @field_validator("indexed_repos", mode="before")
    @classmethod
    def _split_indexed_repos(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [repo.strip() for repo in value.split(",") if repo.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
