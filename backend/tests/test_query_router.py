from unittest.mock import patch

from fastapi.testclient import TestClient

import config
import config_store
from ingestion.embed import EmbeddingError
from main import app
from models import RetrieveResult
from synthesis.answer import SynthesisError

client = TestClient(app)


def _result(make_unit, ref: str) -> RetrieveResult:
    return RetrieveResult(
        unit=make_unit(
            id=f"owner/repo:pr:{ref}", ref=ref, url=f"https://github.com/owner/repo/pull/{ref}"
        ),
        score=0.9,
    )


def test_query_returns_answer_with_resolved_citations_and_retrieved_count(make_unit):
    results = [_result(make_unit, "1"), _result(make_unit, "2"), _result(make_unit, "3")]
    cited = [results[0].unit, results[1].unit]

    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = results
        synthesize.return_value = ("Redis was chosen [owner/repo:pr:1].", cited)

        response = client.post("/query", json={"question": "why redis?"})

    assert response.status_code == 200
    synthesize.assert_called_once_with("why redis?", [r.unit for r in results])
    assert response.json() == {
        "answer": "Redis was chosen [owner/repo:pr:1].",
        "citations": [unit.model_dump() for unit in cited],
        "retrieved_count": 3,
        "mode": "synthesized",
    }


def test_query_passes_repos_through_to_search():
    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = []
        synthesize.return_value = ("Nothing in the indexed history covers this question.", [])

        client.post("/query", json={"question": "why redis?", "repos": ["owner/repo"]})

    search.assert_called_once_with("why redis?", repos=["owner/repo"])


def test_query_omitted_repos_searches_all():
    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = []
        synthesize.return_value = ("Nothing in the indexed history covers this question.", [])

        client.post("/query", json={"question": "why redis?"})

    search.assert_called_once_with("why redis?", repos=None)


def test_query_translates_synthesis_error_to_502():
    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = []
        synthesize.side_effect = SynthesisError("Gemini returned 401 during synthesis")

        response = client.post("/query", json={"question": "why redis?"})

    assert response.status_code == 502
    assert "Gemini returned 401" in response.json()["detail"]


def test_query_translates_embedding_error_to_503():
    with patch("routers.query.search") as search:
        search.side_effect = EmbeddingError("failed to reach Ollama for embedding")

        response = client.post("/query", json={"question": "why redis?"})

    assert response.status_code == 503
    assert "failed to reach Ollama" in response.json()["detail"]


def test_query_returns_sources_only_when_no_gemini_key_is_configured(monkeypatch, make_unit, tmp_path):
    # Isolate config_store's fallback path (config.py's _fill_from_config_store):
    # an empty-but-present GEMINI_API_KEY now correctly falls back to the
    # store, so this test must not see the real local config_store.json's
    # own key, or it'd synthesize instead of testing the no-key path.
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("GEMINI_API_KEY", "")
    config.get_settings.cache_clear()

    results = [_result(make_unit, "1"), _result(make_unit, "2")]

    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = results

        response = client.post("/query", json={"question": "why redis?"})

    assert response.status_code == 200
    synthesize.assert_not_called()
    assert response.json() == {
        "answer": None,
        "citations": [r.unit.model_dump() for r in results],
        "retrieved_count": 2,
        "mode": "sources_only",
    }


def test_query_still_synthesizes_when_gemini_key_is_configured(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "key")
    config.get_settings.cache_clear()

    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = []
        synthesize.return_value = ("Nothing in the indexed history covers this question.", [])

        response = client.post("/query", json={"question": "why redis?"})

    assert response.status_code == 200
    synthesize.assert_called_once()
    assert response.json()["mode"] == "synthesized"


def test_query_falls_back_to_sources_only_when_unscoped_and_an_indexed_repo_disallows_cloud_synthesis(
    monkeypatch, tmp_path
):
    # REQUIRED_ENV configures INDEXED_REPOS="owner/repo"; an unscoped query
    # (no `repos` in the request) still touches it, so it must be checked too.
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config_store.set_cloud_synthesis_allowed("owner/repo", False)

    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = []

        response = client.post("/query", json={"question": "why redis?"})

    assert response.status_code == 200
    synthesize.assert_not_called()
    assert response.json()["mode"] == "sources_only"


def test_query_falls_back_to_sources_only_when_a_scoped_repo_disallows_cloud_synthesis(
    monkeypatch, tmp_path, make_unit
):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config_store.set_cloud_synthesis_allowed("owner/private-repo", False)

    results = [_result(make_unit, "1")]

    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = results

        response = client.post(
            "/query", json={"question": "why redis?", "repos": ["owner/private-repo"]}
        )

    assert response.status_code == 200
    synthesize.assert_not_called()
    assert response.json()["mode"] == "sources_only"


def test_query_synthesizes_when_scoped_only_to_allowed_repos(monkeypatch, tmp_path):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    config_store.set_cloud_synthesis_allowed("owner/private-repo", False)
    config_store.set_cloud_synthesis_allowed("owner/public-repo", True)

    with patch("routers.query.search") as search, patch("routers.query.synthesize") as synthesize:
        search.return_value = []
        synthesize.return_value = ("Nothing in the indexed history covers this question.", [])

        response = client.post(
            "/query", json={"question": "why redis?", "repos": ["owner/public-repo"]}
        )

    assert response.status_code == 200
    synthesize.assert_called_once()
    assert response.json()["mode"] == "synthesized"
