import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import ValidationError

from config import Settings, get_settings

REQUIRED_ENV = {
    "GITHUB_TOKEN": "ghp_test",
    "INDEXED_REPOS": "anubhab-m02/BuFin, anubhab-m02/adr-engine ,owner/repo",
    "OLLAMA_EXTRACTION_MODEL": "phi4-mini",
    "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text",
    "GEMINI_API_KEY": "gemini_test",
}


def _set_required_env(monkeypatch):
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)


def test_settings_loads_every_var_from_env(monkeypatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("OLLAMA_HOST", "http://ollama.internal:11434")
    monkeypatch.setenv("CHROMA_DATA_DIR", "/data/chroma")

    settings = Settings()

    assert settings.github_token == "ghp_test"
    assert settings.indexed_repos == [
        "anubhab-m02/BuFin",
        "anubhab-m02/adr-engine",
        "owner/repo",
    ]
    assert settings.ollama_host == "http://ollama.internal:11434"
    assert settings.ollama_extraction_model == "phi4-mini"
    assert settings.ollama_embedding_model == "nomic-embed-text"
    assert settings.gemini_api_key == "gemini_test"
    assert settings.chroma_data_dir == "/data/chroma"


def test_settings_applies_defaults_when_optional_vars_absent(monkeypatch):
    _set_required_env(monkeypatch)

    settings = Settings()

    assert settings.ollama_host == "http://localhost:11434"
    assert settings.chroma_data_dir == "./chroma_data"


def test_indexed_repos_splits_on_comma_and_strips_whitespace(monkeypatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("INDEXED_REPOS", " a/b ,c/d,  e/f  ")

    settings = Settings()

    assert settings.indexed_repos == ["a/b", "c/d", "e/f"]


def test_missing_required_var_raises_validation_error(monkeypatch):
    _set_required_env(monkeypatch)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)

    with pytest.raises(ValidationError):
        Settings()


def test_get_settings_is_cached(monkeypatch):
    _set_required_env(monkeypatch)
    get_settings.cache_clear()

    first = get_settings()
    second = get_settings()

    assert first is second
    get_settings.cache_clear()
