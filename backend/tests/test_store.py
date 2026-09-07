import pytest

import chroma_client
import config


@pytest.fixture
def store_module(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()

    from ingestion import store

    yield store

    config.get_settings.cache_clear()
    chroma_client.get_chroma_client.cache_clear()


def test_upserting_same_id_twice_does_not_duplicate(store_module, make_unit):
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


def test_upsert_units_stores_metadata_and_document_text(store_module, make_unit):
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


def test_query_units_orders_by_score_descending(store_module, make_unit):
    store_module.upsert_units(
        [make_unit(id="owner/repo:pr:1"), make_unit(id="owner/repo:pr:2", title="Other")],
        embeddings=[[1, 0], [0, 1]],
    )

    results = store_module.query_units([1, 0], k=2)

    assert [unit.id for unit, _score in results] == ["owner/repo:pr:1", "owner/repo:pr:2"]
    assert results[0][1] > results[1][1]


def test_query_units_filters_by_repo(store_module, make_unit):
    store_module.upsert_units(
        [
            make_unit(id="owner/a:pr:1", repo="owner/a"),
            make_unit(id="owner/b:pr:1", repo="owner/b"),
        ],
        embeddings=[[1, 0], [1, 0]],
    )

    results = store_module.query_units([1, 0], k=5, repos=["owner/a"])

    assert [unit.id for unit, _score in results] == ["owner/a:pr:1"]


def test_query_units_reconstructs_full_decision_unit(store_module, make_unit):
    unit = make_unit()
    store_module.upsert_units([unit], embeddings=[[1, 0]])

    [(returned, score)] = store_module.query_units([1, 0], k=1)

    assert returned == unit
    assert score == pytest.approx(1.0)


def test_list_units_filters_by_repo(store_module, make_unit):
    store_module.upsert_units(
        [
            make_unit(id="owner/a:pr:1", repo="owner/a"),
            make_unit(id="owner/b:pr:1", repo="owner/b"),
        ],
        embeddings=[[1, 0], [1, 0]],
    )

    units, total = store_module.list_units("owner/a")

    assert [unit.id for unit in units] == ["owner/a:pr:1"]
    assert total == 1


def test_list_units_orders_newest_first(store_module, make_unit):
    store_module.upsert_units(
        [
            make_unit(id="owner/repo:pr:1", date="2026-01-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:2", date="2026-03-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:3", date="2026-02-01T00:00:00Z"),
        ],
        embeddings=[[1, 0], [1, 0], [1, 0]],
    )

    units, _total = store_module.list_units("owner/repo", limit=10)

    assert [unit.id for unit in units] == ["owner/repo:pr:2", "owner/repo:pr:3", "owner/repo:pr:1"]


def test_list_units_filters_by_since_and_until(store_module, make_unit):
    store_module.upsert_units(
        [
            make_unit(id="owner/repo:pr:1", date="2026-01-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:2", date="2026-02-01T00:00:00Z"),
            make_unit(id="owner/repo:pr:3", date="2026-03-01T00:00:00Z"),
        ],
        embeddings=[[1, 0], [1, 0], [1, 0]],
    )

    units, total = store_module.list_units(
        "owner/repo", since="2026-01-15T00:00:00Z", until="2026-02-15T00:00:00Z"
    )

    assert [unit.id for unit in units] == ["owner/repo:pr:2"]
    assert total == 1


def test_list_units_paginates_without_duplicates_or_gaps(store_module, make_unit):
    units = [make_unit(id=f"owner/repo:pr:{i}", date=f"2026-01-{i:02d}T00:00:00Z") for i in range(1, 6)]
    store_module.upsert_units(units, embeddings=[[1, 0]] * 5)

    page_one, total_one = store_module.list_units("owner/repo", limit=2, offset=0)
    page_two, total_two = store_module.list_units("owner/repo", limit=2, offset=2)
    page_three, total_three = store_module.list_units("owner/repo", limit=2, offset=4)

    all_ids = [unit.id for page in (page_one, page_two, page_three) for unit in page]
    assert len(all_ids) == len(set(all_ids)) == 5
    assert total_one == total_two == total_three == 5
    assert [len(page_one), len(page_two), len(page_three)] == [2, 2, 1]


def test_list_units_with_no_matches_returns_empty(store_module):
    units, total = store_module.list_units("owner/repo")

    assert units == []
    assert total == 0


def test_count_units_counts_only_matching_repo(store_module, make_unit):
    store_module.upsert_units(
        [
            make_unit(id="owner/repo:pr:1"),
            make_unit(id="owner/repo:pr:2"),
            make_unit(id="owner/other:pr:1", repo="owner/other"),
        ],
        embeddings=[[1, 0], [1, 0], [1, 0]],
    )

    assert store_module.count_units("owner/repo") == 2
    assert store_module.count_units("owner/other") == 1


def test_count_units_with_no_matches_returns_zero(store_module):
    assert store_module.count_units("owner/repo") == 0


def test_files_changed_round_trips_through_upsert_and_query(store_module, make_unit):
    unit = make_unit(files_changed=["backend/auth.py", "backend/models.py"])
    store_module.upsert_units([unit], embeddings=[[1, 0]])

    [(returned, _score)] = store_module.query_units([1, 0], k=1)

    assert returned.files_changed == ["backend/auth.py", "backend/models.py"]


def test_files_changed_defaults_to_empty_list_for_units_stored_without_it(
    store_module, make_unit
):
    unit = make_unit()
    metadata = store_module._metadata(unit)
    del metadata["files_changed"]

    store_module.get_collection().upsert(
        ids=[unit.id],
        embeddings=[[1, 0]],
        documents=[store_module._document_text(unit)],
        metadatas=[metadata],
    )

    [(returned, _score)] = store_module.query_units([1, 0], k=1)

    assert returned.files_changed == []


def test_clear_all_empties_collection_and_cursor_file(store_module, make_unit):
    store_module.upsert_units([make_unit()], embeddings=[[0.1, 0.2, 0.3]])
    store_module.set_cursor("owner/repo", {"last_commit_date": "2026-01-01T00:00:00Z"})

    store_module.clear_all()

    assert store_module.get_collection().count() == 0
    assert store_module.get_cursor("owner/repo") == {}


def test_clear_all_on_empty_store_is_a_noop(store_module):
    store_module.clear_all()

    assert store_module.get_collection().count() == 0


def test_set_cursor_preserves_other_repos(store_module):
    store_module.set_cursor("owner/repo", {"last_commit_date": "2026-01-01T00:00:00Z"})
    store_module.set_cursor("owner/other", {"last_commit_date": "2026-02-01T00:00:00Z"})

    assert store_module.get_cursor("owner/repo") == {
        "last_commit_date": "2026-01-01T00:00:00Z"
    }
    assert store_module.get_cursor("owner/other") == {
        "last_commit_date": "2026-02-01T00:00:00Z"
    }
