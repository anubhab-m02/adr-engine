import pytest
from fastapi.testclient import TestClient

import chroma_client
import config
from ingestion import store
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _repos_env(tmp_path, monkeypatch):
    """This router counts real Chroma-stored units, so it needs its own
    tmp_path collection and multi-repo config (overrides conftest's
    single-repo, no-Chroma-write default)."""
    monkeypatch.setenv("INDEXED_REPOS", "owner/a,owner/b")
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()

    yield

    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()


def test_repos_returns_counts_per_repo(make_unit):
    store.upsert_units(
        [
            make_unit(id="owner/a:pr:1", repo="owner/a", url="https://github.com/owner/a/pull/1"),
            make_unit(id="owner/a:pr:2", repo="owner/a", url="https://github.com/owner/a/pull/2"),
            make_unit(id="owner/b:pr:1", repo="owner/b", url="https://github.com/owner/b/pull/1"),
        ],
        embeddings=[[1, 0], [1, 0], [1, 0]],
    )

    response = client.get("/repos")

    assert response.status_code == 200
    assert response.json() == {
        "repos": [
            {"repo": "owner/a", "indexed_units": 2},
            {"repo": "owner/b", "indexed_units": 1},
        ]
    }


def test_repos_with_zero_indexed_units_still_appears(make_unit):
    store.upsert_units(
        [make_unit(id="owner/a:pr:1", repo="owner/a", url="https://github.com/owner/a/pull/1")],
        embeddings=[[1, 0]],
    )

    response = client.get("/repos")

    assert response.status_code == 200
    assert response.json() == {
        "repos": [
            {"repo": "owner/a", "indexed_units": 1},
            {"repo": "owner/b", "indexed_units": 0},
        ]
    }


def test_delete_repos_clears_units_cursors_and_indexed_repos(make_unit, monkeypatch):
    """Full-wipe "clear index" (#84): indexed_repos here comes from
    config_store (not the INDEXED_REPOS env override the other tests in
    this file rely on) to match how repos are actually registered via
    PATCH /config in production."""
    monkeypatch.delenv("INDEXED_REPOS", raising=False)
    client.patch("/config", json={"indexed_repos": ["owner/a", "owner/b"]})
    store.upsert_units(
        [make_unit(id="owner/a:pr:1", repo="owner/a", url="https://github.com/owner/a/pull/1")],
        embeddings=[[1, 0]],
    )
    store.set_cursor("owner/a", {"last_commit_date": "2026-01-01T00:00:00Z"})

    # Populate the cached Settings singleton before clearing, so this
    # also proves the endpoint invalidates it rather than leaving GET
    # /repos serving a stale indexed_repos list.
    assert client.get("/repos").json()["repos"]

    response = client.delete("/repos")

    assert response.status_code == 200
    assert client.get("/repos").json() == {"repos": []}
    assert store.get_cursor("owner/a") == {}
