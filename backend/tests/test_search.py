from unittest.mock import patch

import pytest

import chroma_client
import config
from models import DecisionUnit

REQUIRED_ENV = {
    "GITHUB_TOKEN": "tok",
    "INDEXED_REPOS": "owner/repo",
    "OLLAMA_EXTRACTION_MODEL": "phi4-mini",
    "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text",
    "GEMINI_API_KEY": "key",
}


def make_unit(**overrides) -> DecisionUnit:
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


@pytest.fixture
def search_module(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)

    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()

    from ingestion import store
    from retrieval import search

    yield search, store

    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()


def test_search_returns_top_k_ordered_by_score(search_module):
    search, store = search_module
    store.upsert_units(
        [
            make_unit(id="owner/repo:pr:1", title="Exact match"),
            make_unit(id="owner/repo:pr:2", title="Partial match"),
        ],
        embeddings=[[2, 0], [1, 1]],
    )

    with patch("ingestion.embed.embed_text", return_value=[1, 0]):
        results = search.search("why redis?", k=2)

    assert [r.unit.id for r in results] == ["owner/repo:pr:1", "owner/repo:pr:2"]
    assert results[0].score > results[1].score


def test_search_excludes_results_below_relevance_floor(search_module):
    search, store = search_module
    store.upsert_units(
        [
            make_unit(id="owner/repo:pr:1", title="Exact match"),
            make_unit(id="owner/repo:pr:2", title="Unrelated"),
        ],
        embeddings=[[2, 0], [0, 1]],
    )

    with patch("ingestion.embed.embed_text", return_value=[1, 0]):
        results = search.search("why redis?", k=2)

    assert [r.unit.id for r in results] == ["owner/repo:pr:1"]


def test_search_filters_by_repo(search_module):
    search, store = search_module
    store.upsert_units(
        [
            make_unit(id="owner/a:pr:1", repo="owner/a"),
            make_unit(id="owner/b:pr:1", repo="owner/b"),
        ],
        embeddings=[[1, 0], [1, 0]],
    )

    with patch("ingestion.embed.embed_text", return_value=[1, 0]):
        results = search.search("why redis?", k=5, repos=["owner/a"])

    assert [r.unit.id for r in results] == ["owner/a:pr:1"]


def test_search_embeds_query_via_embed_text(search_module):
    search, store = search_module
    store.upsert_units([make_unit()], embeddings=[[1, 0]])

    with patch("ingestion.embed.embed_text", return_value=[1, 0]) as embed_text:
        search.search("why redis?", k=1)

    embed_text.assert_called_once_with("why redis?")
