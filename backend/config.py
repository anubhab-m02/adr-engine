"""Application settings.

The only place environment variables are read. Every other module
imports `get_settings()` instead of touching `os.environ` directly.
"""

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    github_token: str
    indexed_repos: Annotated[list[str], NoDecode]
    ollama_host: str = "http://localhost:11434"
    ollama_extraction_model: str
    ollama_embedding_model: str
    gemini_api_key: str
    chroma_data_dir: str = "./chroma_data"
    github_rate_limit_wait_ceiling_seconds: float = 60
    github_request_timeout_seconds: float = 10
    ollama_request_timeout_seconds: float = 60

    @field_validator("indexed_repos", mode="before")
    @classmethod
    def _split_indexed_repos(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [repo.strip() for repo in value.split(",") if repo.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
