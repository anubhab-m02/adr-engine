from unittest.mock import patch

import httpx
import pytest

import config
from ingestion.embed import EmbeddingError, embed_text


def test_embed_text_returns_vector_on_success():
    with patch("ingestion.embed.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json={"embedding": [0.1, 0.2, 0.3]})

        vector = embed_text("some decision text")

    assert vector == [0.1, 0.2, 0.3]
    assert all(isinstance(value, float) for value in vector)

    _, kwargs = mock_post.call_args
    assert kwargs["json"] == {"model": "nomic-embed-text", "prompt": "some decision text"}


def test_embed_text_raises_embedding_error_on_connection_failure():
    with patch("ingestion.embed.httpx.post", side_effect=httpx.ConnectError("refused")):
        with pytest.raises(EmbeddingError):
            embed_text("some decision text")


def test_embed_text_raises_embedding_error_on_non_2xx():
    with patch("ingestion.embed.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(500, json={"error": "boom"})

        with pytest.raises(EmbeddingError):
            embed_text("some decision text")


def test_embed_text_raises_embedding_error_on_unexpected_response_shape():
    with patch("ingestion.embed.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json={"unexpected": "shape"})

        with pytest.raises(EmbeddingError):
            embed_text("some decision text")


def test_embed_text_raises_embedding_error_on_timeout():
    with patch("ingestion.embed.httpx.post", side_effect=httpx.TimeoutException("timed out")):
        with pytest.raises(EmbeddingError):
            embed_text("some decision text")


def test_embed_text_passes_configured_timeout():
    with patch("ingestion.embed.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json={"embedding": [0.1]})

        embed_text("some decision text")

    _, kwargs = mock_post.call_args
    assert kwargs["timeout"] == config.get_settings().ollama_request_timeout_seconds
