import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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
def store_module(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)

    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()

    from ingestion import store

    yield store

    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()


def test_upserting_same_id_twice_does_not_duplicate(store_module):
    unit = make_unit()

    store_module.upsert_units([unit], embeddings=[[0.1, 0.2, 0.3]])
    store_module.upsert_units(
        [make_unit(title="Add caching layer (revised)")],
        embeddings=[[0.4, 0.5, 0.6]],
    )

    collection = store_module.get_collection()
    assert collection.count() == 1

    stored = collection.get(ids=[unit.id], include=["metadatas", "documents"])
    assert stored["metadatas"][0]["title"] == "Add caching layer (revised)"
    assert stored["documents"][0].startswith("Add caching layer (revised)")


def test_upsert_units_stores_metadata_and_document_text(store_module):
    unit = make_unit()

    store_module.upsert_units([unit], embeddings=[[0.1, 0.2, 0.3]])

    collection = store_module.get_collection()
    stored = collection.get(ids=[unit.id], include=["metadatas", "documents"])

    assert stored["documents"][0] == "Add caching layer\nUse Redis for the cache\nNeeded shared state across instances"
    assert stored["metadatas"][0]["repo"] == "owner/repo"
    assert stored["metadatas"][0]["kind"] == "pr"


def test_upsert_units_with_empty_list_is_a_noop(store_module):
    store_module.upsert_units([], embeddings=[])

    assert store_module.get_collection().count() == 0


def test_get_cursor_with_no_prior_cursor_returns_empty_dict(store_module):
    assert store_module.get_cursor("owner/repo") == {}


def test_cursor_round_trips_through_disk(store_module):
    store_module.set_cursor("owner/repo", {"last_commit_date": "2026-01-01T00:00:00Z"})

    assert store_module.get_cursor("owner/repo") == {
        "last_commit_date": "2026-01-01T00:00:00Z"
    }
    assert store_module.get_cursor("owner/other") == {}


def test_query_units_orders_by_score_descending(store_module):
    store_module.upsert_units(
        [make_unit(id="owner/repo:pr:1"), make_unit(id="owner/repo:pr:2", title="Other")],
        embeddings=[[1, 0], [0, 1]],
    )

    results = store_module.query_units([1, 0], k=2)

    assert [unit.id for unit, _score in results] == ["owner/repo:pr:1", "owner/repo:pr:2"]
    assert results[0][1] > results[1][1]


def test_query_units_filters_by_repo(store_module):
    store_module.upsert_units(
        [
            make_unit(id="owner/a:pr:1", repo="owner/a"),
            make_unit(id="owner/b:pr:1", repo="owner/b"),
        ],
        embeddings=[[1, 0], [1, 0]],
    )

    results = store_module.query_units([1, 0], k=5, repos=["owner/a"])

    assert [unit.id for unit, _score in results] == ["owner/a:pr:1"]


def test_query_units_reconstructs_full_decision_unit(store_module):
    unit = make_unit()
    store_module.upsert_units([unit], embeddings=[[1, 0]])

    [(returned, score)] = store_module.query_units([1, 0], k=1)

    assert returned == unit
    assert score == pytest.approx(1.0)


def test_set_cursor_preserves_other_repos(store_module):
    store_module.set_cursor("owner/repo", {"last_commit_date": "2026-01-01T00:00:00Z"})
    store_module.set_cursor("owner/other", {"last_commit_date": "2026-02-01T00:00:00Z"})

    assert store_module.get_cursor("owner/repo") == {
        "last_commit_date": "2026-01-01T00:00:00Z"
    }
    assert store_module.get_cursor("owner/other") == {
        "last_commit_date": "2026-02-01T00:00:00Z"
    }
