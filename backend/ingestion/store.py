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
    return get_chroma_client().get_or_create_collection(name=COLLECTION_NAME)


def _document_text(unit: DecisionUnit) -> str:
    return f"{unit.title}\n{unit.decision}\n{unit.rationale}"


def _metadata(unit: DecisionUnit) -> dict:
    metadata = unit.model_dump(exclude={"id"})
    metadata["alternatives"] = json.dumps(metadata["alternatives"])
    return metadata


def upsert_units(units: list[DecisionUnit], embeddings: list[list[float]]) -> None:
    if not units:
        return

    get_collection().upsert(
        ids=[unit.id for unit in units],
        embeddings=embeddings,
        documents=[_document_text(unit) for unit in units],
        metadatas=[_metadata(unit) for unit in units],
    )


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
