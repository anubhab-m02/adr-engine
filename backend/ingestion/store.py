"""Chroma store layer: idempotent DecisionUnit upsert and ingestion cursors.

Chroma's own `id` field is `DecisionUnit.id`, so upserting an already-seen
commit/PR overwrites the existing entry instead of duplicating it. The
cursor file lives at `{CHROMA_DATA_DIR}/cursors.json`, keyed by repo, per
SYSTEM-DESIGN.md.
"""

import json
from pathlib import Path

import chromadb

from chroma_client import get_chroma_client
from config import get_settings
from models import DecisionUnit

COLLECTION_NAME = "decisions"


def get_collection() -> chromadb.Collection:
    return get_chroma_client().get_or_create_collection(
        name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )


def clear_all() -> None:
    """Wipe every indexed decision and ingestion cursor (full-wipe "clear
    index" action, not per-repo removal). Deletes by id rather than
    dropping the collection so this is a no-op on an empty/fresh store
    instead of erroring on a not-yet-created collection."""
    collection = get_collection()
    ids = collection.get(include=[])["ids"]
    if ids:
        collection.delete(ids=ids)

    path = _cursor_path()
    if path.exists():
        path.unlink()


def _document_text(unit: DecisionUnit) -> str:
    return f"{unit.title}\n{unit.decision}\n{unit.rationale}"


def _metadata(unit: DecisionUnit) -> dict:
    metadata = unit.model_dump(exclude={"id"})
    metadata["alternatives"] = json.dumps(metadata["alternatives"])
    metadata["files_changed"] = json.dumps(metadata["files_changed"])
    return metadata


def _unit_from_metadata(id: str, metadata: dict) -> DecisionUnit:
    fields = dict(metadata)
    fields["alternatives"] = json.loads(fields["alternatives"])
    fields["files_changed"] = json.loads(fields.get("files_changed", "[]"))
    return DecisionUnit(id=id, **fields)


def upsert_units(units: list[DecisionUnit], embeddings: list[list[float]]) -> None:
    if not units:
        return

    get_collection().upsert(
        ids=[unit.id for unit in units],
        embeddings=embeddings,
        documents=[_document_text(unit) for unit in units],
        metadatas=[_metadata(unit) for unit in units],
    )


def query_units(
    vector: list[float], k: int, repos: list[str] | None = None
) -> list[tuple[DecisionUnit, float]]:
    """Top-k nearest units to `vector`, scored by cosine similarity (1 -
    cosine distance, per the collection's `hnsw:space: cosine` config)."""
    where = {"repo": {"$in": repos}} if repos else None

    result = get_collection().query(
        query_embeddings=[vector],
        n_results=k,
        where=where,
        include=["metadatas", "distances"],
    )

    ids = result["ids"][0]
    metadatas = result["metadatas"][0]
    distances = result["distances"][0]

    return [
        (_unit_from_metadata(id, metadata), 1 - distance)
        for id, metadata, distance in zip(ids, metadatas, distances)
    ]


def list_units(
    repo: str,
    since: str | None = None,
    until: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[DecisionUnit], int]:
    """All units for `repo`, optionally bounded by `since`/`until` (both
    inclusive, compared lexicographically against `DecisionUnit.date` —
    which sorts correctly since dates are ISO 8601 strings), newest
    first. Chroma's `where` only does exact-match filtering reliably for
    string metadata, so the date bounds and pagination are applied here
    rather than pushed into the query; sorting by `(date, id)` before
    slicing keeps pages stable (no duplicates/gaps) across calls for a
    fixed dataset.

    Returns `(page, total)` where `total` is the count before slicing,
    for the caller to compute page count.
    """
    result = get_collection().get(where={"repo": repo}, include=["metadatas"])
    units = [_unit_from_metadata(id, metadata) for id, metadata in zip(result["ids"], result["metadatas"])]

    if since is not None:
        units = [unit for unit in units if unit.date >= since]
    if until is not None:
        units = [unit for unit in units if unit.date <= until]

    units.sort(key=lambda unit: (unit.date, unit.id), reverse=True)

    return units[offset : offset + limit], len(units)


def count_units(repo: str) -> int:
    return len(get_collection().get(where={"repo": repo}, include=[])["ids"])


def count_units_by_path(repo: str) -> dict[str, int]:
    """Decision counts per file path for `repo`, from each unit's
    `files_changed` — a file touched by 3 decisions counts 3, not 1."""
    result = get_collection().get(where={"repo": repo}, include=["metadatas"])

    counts: dict[str, int] = {}
    for metadata in result["metadatas"]:
        for path in json.loads(metadata.get("files_changed", "[]")):
            counts[path] = counts.get(path, 0) + 1

    return counts


def _cursor_path() -> Path:
    return Path(get_settings().chroma_data_dir) / "cursors.json"


def get_cursor(repo: str) -> dict:
    path = _cursor_path()
    if not path.exists():
        return {}

    cursors = json.loads(path.read_text())
    return cursors.get(repo, {})


def set_cursor(repo: str, cursor: dict) -> None:
    path = _cursor_path()
    cursors = json.loads(path.read_text()) if path.exists() else {}
    cursors[repo] = cursor

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cursors))
