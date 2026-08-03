import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

import config_store
from config import get_settings
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))


def test_get_config_on_empty_store_returns_defaults(tmp_path):
    response = client.get("/config")

    assert response.status_code == 200
    assert response.json() == {
        "github_token": None,
        "gemini_api_key": None,
        "indexed_repos": [],
        "ollama_host": "http://localhost:11434",
        "ollama_extraction_model": None,
        "ollama_embedding_model": None,
        "gemini_model": "gemini-2.5-flash",
        "chroma_data_dir": str(tmp_path),
    }


def test_patch_ignores_chroma_data_dir_since_it_is_env_derived(tmp_path):
    response = client.patch("/config", json={"chroma_data_dir": "/somewhere/else"})

    assert response.status_code == 200
    assert response.json()["chroma_data_dir"] == str(tmp_path)
    assert "chroma_data_dir" not in config_store.load()


def test_patch_persists_and_is_reflected_in_a_subsequent_get():
    patch_response = client.patch("/config", json={"indexed_repos": ["owner/repo"]})
    assert patch_response.status_code == 200
    assert patch_response.json()["indexed_repos"] == ["owner/repo"]

    get_response = client.get("/config")
    assert get_response.json()["indexed_repos"] == ["owner/repo"]


def test_patch_only_updates_the_provided_fields():
    client.patch("/config", json={"gemini_model": "gemini-2.5-pro"})
    response = client.patch("/config", json={"indexed_repos": ["owner/repo"]})

    assert response.json()["gemini_model"] == "gemini-2.5-pro"
    assert response.json()["indexed_repos"] == ["owner/repo"]


def test_secrets_are_masked_in_patch_and_get_responses():
    token = "ghp_1234567890abcdef"

    patch_response = client.patch("/config", json={"github_token": token})
    get_response = client.get("/config")

    for response in (patch_response, get_response):
        body = response.json()
        assert body["github_token"] == "ghp_…cdef"
        assert token not in response.text


def test_patch_rejects_an_empty_string_field():
    response = client.patch("/config", json={"github_token": "   "})

    assert response.status_code == 422


def test_patch_invalidates_the_cached_settings_singleton(monkeypatch):
    # get_settings() is @lru_cache'd; other routers (query, repos,
    # github_client...) read it instead of config_store directly, so a
    # PATCH here must invalidate that cache or they'd keep serving the
    # pre-patch value (e.g. a stale/empty Gemini key) until process
    # restart, per the "no Gemini key" bug found running the live app.
    # GEMINI_API_KEY must be unset here since env always wins over the
    # store (config.py) — this test is about the store's value reaching
    # a fresh Settings(), not about env precedence.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    get_settings()  # populate the cache with the pre-patch value

    client.patch("/config", json={"gemini_api_key": "gk_1234567890abcdef"})

    assert get_settings().gemini_api_key == "gk_1234567890abcdef"


def test_patch_can_clear_indexed_repos_without_touching_other_fields():
    client.patch("/config", json={"gemini_api_key": "gk_1234567890abcdef"})

    response = client.patch("/config", json={"indexed_repos": []})

    assert response.status_code == 200
    assert response.json()["gemini_api_key"] == "gk_1…cdef"
    assert response.json()["indexed_repos"] == []
