import pytest
from fastapi.testclient import TestClient

import chroma_client
import config
from ingestion import store
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _decisions_env(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()

    yield

    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()


def test_decisions_returns_units_for_requested_repo_only(make_unit):
    store.upsert_units(
        [
            make_unit(id="owner/a:pr:1", repo="owner/a"),
            make_unit(id="owner/b:pr:1", repo="owner/b"),
        ],
        embeddings=[[1, 0], [1, 0]],
    )

    response = client.get("/decisions", params={"repo": "owner/a"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [unit["id"] for unit in body["units"]] == ["owner/a:pr:1"]


def test_decisions_with_no_matches_returns_empty_list():
    response = client.get("/decisions", params={"repo": "owner/repo"})

    assert response.status_code == 200
    assert response.json() == {"units": [], "total": 0, "page": 1, "limit": 20}


def test_decisions_filters_by_since_and_until(make_unit):
    store.upsert_units(
        [
            make_unit(id="owner/repo:pr:1", date="2026-01-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:2", date="2026-02-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:3", date="2026-03-01T00:00:00Z"),
        ],
        embeddings=[[1, 0], [1, 0], [1, 0]],
    )

    response = client.get(
        "/decisions",
        params={"repo": "owner/repo", "since": "2026-01-15T00:00:00Z", "until": "2026-02-15T00:00:00Z"},
    )

    assert response.status_code == 200
    assert [unit["id"] for unit in response.json()["units"]] == ["owner/repo:pr:2"]


def test_decisions_since_and_until_bounds_are_inclusive(make_unit):
    store.upsert_units(
        [make_unit(id="owner/repo:pr:1", date="2026-01-01T00:00:00Z")],
        embeddings=[[1, 0]],
    )

    response = client.get(
        "/decisions",
        params={"repo": "owner/repo", "since": "2026-01-01T00:00:00Z", "until": "2026-01-01T00:00:00Z"},
    )

    assert [unit["id"] for unit in response.json()["units"]] == ["owner/repo:pr:1"]


def test_decisions_orders_newest_first(make_unit):
    store.upsert_units(
        [
            make_unit(id="owner/repo:pr:1", date="2026-01-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:2", date="2026-03-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:3", date="2026-02-01T00:00:00Z"),
        ],
        embeddings=[[1, 0], [1, 0], [1, 0]],
    )

    response = client.get("/decisions", params={"repo": "owner/repo", "limit": 10})

    assert [unit["id"] for unit in response.json()["units"]] == [
        "owner/repo:pr:2",
        "owner/repo:pr:3",
        "owner/repo:pr:1",
    ]


def test_decisions_paginates_without_duplicates_or_gaps(make_unit):
    units = [make_unit(id=f"owner/repo:pr:{i}", date=f"2026-01-{i:02d}T00:00:00Z") for i in range(1, 6)]
    store.upsert_units(units, embeddings=[[1, 0]] * 5)

    pages = [
        client.get("/decisions", params={"repo": "owner/repo", "page": page, "limit": 2}).json()
        for page in (1, 2, 3)
    ]

    all_ids = [unit["id"] for page in pages for unit in page["units"]]
    assert len(all_ids) == len(set(all_ids)) == 5
    assert all(page["total"] == 5 for page in pages)
    assert [len(page["units"]) for page in pages] == [2, 2, 1]
