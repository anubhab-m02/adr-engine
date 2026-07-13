"""Ollama embedding wrapper: text -> vector.

Shared by ingestion (embedding decision units) and retrieval (embedding
queries), per ARCHITECTURE.md.
"""

import httpx

from config import get_settings


class EmbeddingError(Exception):
    """Raised on connection failure or an unexpected Ollama response shape."""


def embed_text(text: str) -> list[float]:
    settings = get_settings()

    try:
        response = httpx.post(
            f"{settings.ollama_host}/api/embeddings",
            json={"model": settings.ollama_embedding_model, "prompt": text},
        )
    except httpx.HTTPError as exc:
        raise EmbeddingError(f"failed to reach Ollama for embedding: {exc}") from exc

    if response.is_error:
        raise EmbeddingError(f"Ollama returned {response.status_code} during embedding")

    try:
        embedding = response.json()["embedding"]
    except (ValueError, KeyError) as exc:
        raise EmbeddingError("Ollama embedding response missing 'embedding' field") from exc

    if not isinstance(embedding, list):
        raise EmbeddingError("Ollama embedding response 'embedding' field was not a list")

    return [float(value) for value in embedding]
