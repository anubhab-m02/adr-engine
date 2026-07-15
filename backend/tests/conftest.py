"""Shared pytest fixtures: sample DecisionUnit, temp Chroma client, fixture loader.

Kept here so every later issue's tests can pull these in without each one
re-inventing setup, per ARCHITECTURE.md's no-network/no-Ollama testing rule.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import chromadb
import pytest

import config
from models import DecisionUnit

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

REQUIRED_ENV = {
    "GITHUB_TOKEN": "tok",
    "INDEXED_REPOS": "owner/repo",
    "OLLAMA_EXTRACTION_MODEL": "phi4-mini",
    "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text",
    "GEMINI_API_KEY": "key",
}


@pytest.fixture(autouse=True)
def _settings_env(monkeypatch):
    """Populate required Settings env vars for every test; individual
    tests/modules can monkeypatch additional overrides afterward."""
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)
    config.get_settings.cache_clear()

    yield

    config.get_settings.cache_clear()


@pytest.fixture
def sample_decision_unit() -> DecisionUnit:
    return DecisionUnit(
        id="octocat/Hello-World:pr:42",
        repo="octocat/Hello-World",
        kind="pr",
        ref="42",
        url="https://github.com/octocat/Hello-World/pull/42",
        author="octocat",
        date="2026-03-14T16:05:00Z",
        title="Switch auth to session tokens",
        decision="Use server-side session tokens backed by Redis instead of JWTs",
        rationale="JWTs couldn't be revoked without maintaining a blocklist.",
        alternatives=["JWT with a revocation blocklist", "opaque tokens via Redis"],
        source_excerpt="JWTs couldn't be revoked without maintaining a blocklist.",
    )


@pytest.fixture
def tmp_chroma_client(tmp_path) -> chromadb.ClientAPI:
    return chromadb.PersistentClient(path=str(tmp_path))


@pytest.fixture
def make_unit():
    def _make(**overrides) -> DecisionUnit:
        fields = {
            "id": "owner/repo:pr:1",
            "repo": "owner/repo",
            "kind": "pr",
            "ref": "1",
            "url": "https://github.com/owner/repo/pull/1",
            "author": "someone",
            "date": "2026-01-01T00:00:00Z",
            "title": "Add caching layer",
            "decision": "Use Redis for the cache",
            "rationale": "Needed shared state across instances",
            "alternatives": ["in-memory cache", "Memcached"],
            "source_excerpt": "Discussion about caching options.",
        }
        fields.update(overrides)
        return DecisionUnit(**fields)

    return _make


@pytest.fixture
def load_fixture():
    def _load(name: str):
        path = FIXTURES_DIR / name
        if path.suffix == ".json":
            return json.loads(path.read_text())
        return path.read_text()

    return _load
