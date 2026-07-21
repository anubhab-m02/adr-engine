import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
import config_store


def test_load_on_missing_file_returns_defaults(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    assert config_store.load() == config_store.DEFAULTS


def test_save_and_load_round_trips(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.save({"github_token": "ghp_abc"})

    assert config_store.load()["github_token"] == "ghp_abc"


def test_save_merges_rather_than_replaces(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.save({"indexed_repos": ["owner/repo"]})
    config_store.save({"ollama_host": "http://custom:11434"})

    stored = config_store.load()
    assert stored["indexed_repos"] == ["owner/repo"]
    assert stored["ollama_host"] == "http://custom:11434"


def test_save_returns_the_merged_config(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    config_store.save({"gemini_api_key": "gk_1"})
    result = config_store.save({"gemini_model": "gemini-2.5-pro"})

    assert result["gemini_api_key"] == "gk_1"
    assert result["gemini_model"] == "gemini-2.5-pro"


def test_env_var_overrides_a_stored_value_when_both_set(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config_store.save({"github_token": "ghp_from_store"})
    monkeypatch.setenv("GITHUB_TOKEN", "ghp_from_env")
    config.get_settings.cache_clear()

    settings = config.Settings()

    assert settings.github_token == "ghp_from_env"
    config.get_settings.cache_clear()


def test_stored_value_used_when_env_var_unset(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config_store.save({"gemini_api_key": "gk_from_store"})
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    config.get_settings.cache_clear()

    settings = config.Settings()

    assert settings.gemini_api_key == "gk_from_store"
    config.get_settings.cache_clear()
