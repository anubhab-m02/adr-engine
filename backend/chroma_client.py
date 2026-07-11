"""Chroma client factory for the adr-engine backend.

Reads CHROMA_DATA_DIR from the environment so the vector store persists to
disk rather than living in memory only (see ROADMAP.md Phase 1, step 4).
"""

import os
from functools import lru_cache

import chromadb

DEFAULT_CHROMA_DATA_DIR = "./chroma_data"


@lru_cache
def get_chroma_client():
    """Return a process-wide, disk-persisted Chroma client.

    Cached so repeated calls (e.g. across FastAPI request handlers) reuse
    the same client instead of reopening the store on every call.
    """
    data_dir = os.environ.get("CHROMA_DATA_DIR", DEFAULT_CHROMA_DATA_DIR)
    return chromadb.PersistentClient(path=data_dir)
