"""Tests for chroma_client.get_chroma_client."""

from pathlib import Path
from unittest.mock import patch

import pytest

import chroma_client
from chroma_client import DEFAULT_CHROMA_DATA_DIR, get_chroma_client


@pytest.fixture(autouse=True)
def _clear_cache():
    get_chroma_client.cache_clear()
    yield
    get_chroma_client.cache_clear()


def test_persists_to_chroma_data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    client = get_chroma_client()
    client.get_or_create_collection("probe")
    assert any(Path(tmp_path).iterdir())


def test_returns_same_instance(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    assert get_chroma_client() is get_chroma_client()


def test_default_path_when_env_unset(monkeypatch):
    monkeypatch.delenv("CHROMA_DATA_DIR", raising=False)
    with patch.object(chroma_client.chromadb, "PersistentClient") as pc:
        get_chroma_client()
    pc.assert_called_once_with(path=DEFAULT_CHROMA_DATA_DIR)
    assert DEFAULT_CHROMA_DATA_DIR == "./chroma_data"
