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
