from unittest.mock import patch

from fastapi.testclient import TestClient

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
