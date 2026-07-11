"""Chroma client factory.

Reads CHROMA_DATA_DIR from the environment and returns a persistent,
file-backed client. Cached so the whole app shares one client instance
instead of re-opening the store on every request.
"""

from functools import lru_cache
import os

import chromadb
from dotenv import load_dotenv

load_dotenv()

DEFAULT_CHROMA_DATA_DIR = "./chroma_data"


@lru_cache
def get_chroma_client() -> chromadb.ClientAPI:
    data_dir = os.getenv("CHROMA_DATA_DIR", DEFAULT_CHROMA_DATA_DIR)
    return chromadb.PersistentClient(path=data_dir)
