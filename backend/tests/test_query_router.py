from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from models import DecisionUnit, RetrieveResult

client = TestClient(app)


def _result(ref: str) -> RetrieveResult:
    return RetrieveResult(
        unit=DecisionUnit(
            id=f"owner/repo:pr:{ref}",
            repo="owner/repo",
            kind="pr",
            ref=ref,
            url=f"https://github.com/owner/repo/pull/{ref}",
            author="someone",
            date="2026-01-01T00:00:00Z",
            title="Add caching layer",
            decision="Use Redis for the cache",
            rationale="Needed shared state across instances",
            alternatives=[],
            source_excerpt="Discussion about caching options.",
        ),
        score=0.9,
    )


def test_query_returns_answer_with_resolved_citations_and_retrieved_count():
    results = [_result("1"), _result("2"), _result("3")]
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
