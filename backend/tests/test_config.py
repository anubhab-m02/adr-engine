import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import ValidationError

import config_store
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


def test_missing_required_var_raises_validation_error(monkeypatch, tmp_path):
    # Isolate config_store's fallback path from the real local
    # {CHROMA_DATA_DIR}/config.json — if that file happens to have a
    # real github_token saved (e.g. from actually using the app), the
    # model_validator would silently fill the "missing" var back in
    # from the store and this test would no longer test anything.
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    _set_required_env(monkeypatch)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)

    with pytest.raises(ValidationError):
        Settings()


def test_empty_env_var_still_falls_back_to_config_store(monkeypatch, tmp_path):
    # A `.env` line like `GEMINI_API_KEY=` (declared but empty) used to
    # permanently shadow a real value saved in config_store via Settings
    # UI, since the fallback only ran when the key was fully absent from
    # env. Reported live: saving a Gemini key in Settings kept showing
    # "no Gemini key configured" until the .env line itself was removed.
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    _set_required_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "")
    config_store.save({"gemini_api_key": "gk_from_store"})

    settings = Settings()

    assert settings.gemini_api_key == "gk_from_store"


def test_get_settings_is_cached(monkeypatch):
    _set_required_env(monkeypatch)
    get_settings.cache_clear()

    first = get_settings()
    second = get_settings()

    assert first is second
    get_settings.cache_clear()


def test_get_local_repo_path_unset_returns_none(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    assert config_store.get_local_repo_path("owner/repo") is None


def test_set_then_get_local_repo_path_round_trips(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_local_repo_path("owner/repo", "/home/user/code/repo")

    assert config_store.get_local_repo_path("owner/repo") == "/home/user/code/repo"


def test_local_repo_paths_do_not_clobber_each_other(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.set_local_repo_path("owner/repo-a", "/local/repo-a")
    config_store.set_local_repo_path("owner/repo-b", "/local/repo-b")

    assert config_store.get_local_repo_path("owner/repo-a") == "/local/repo-a"
    assert config_store.get_local_repo_path("owner/repo-b") == "/local/repo-b"
