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


def _document_text(unit: DecisionUnit) -> str:
    return f"{unit.title}\n{unit.decision}\n{unit.rationale}"


def _metadata(unit: DecisionUnit) -> dict:
    metadata = unit.model_dump(exclude={"id"})
    metadata["alternatives"] = json.dumps(metadata["alternatives"])
    return metadata


def _unit_from_metadata(id: str, metadata: dict) -> DecisionUnit:
    fields = dict(metadata)
    fields["alternatives"] = json.loads(fields["alternatives"])
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


def count_units(repo: str) -> int:
    return len(get_collection().get(where={"repo": repo}, include=[])["ids"])


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
