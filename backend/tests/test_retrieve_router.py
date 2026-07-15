from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from models import DecisionUnit, RetrieveResult

client = TestClient(app)


def _result(ref: str, score: float) -> RetrieveResult:
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
        score=score,
    )


def test_retrieve_returns_search_results():
    with patch("routers.retrieve.search") as search:
        search.return_value = [_result("1", 0.9), _result("2", 0.5)]

        response = client.post("/retrieve", json={"query": "why redis?", "k": 3})

    assert response.status_code == 200
    search.assert_called_once_with("why redis?", k=3, repos=None)
    assert response.json() == {
        "results": [r.model_dump() for r in [_result("1", 0.9), _result("2", 0.5)]]
    }


def test_retrieve_omitted_k_defaults_to_5():
    with patch("routers.retrieve.search") as search:
        search.return_value = []

        response = client.post("/retrieve", json={"query": "why redis?"})

    assert response.status_code == 200
    search.assert_called_once_with("why redis?", k=5, repos=None)


def test_retrieve_omitted_repos_searches_all():
    with patch("routers.retrieve.search") as search:
        search.return_value = []

        client.post("/retrieve", json={"query": "why redis?", "repos": None})

    search.assert_called_once_with("why redis?", k=5, repos=None)


def test_retrieve_passes_repos_through():
    with patch("routers.retrieve.search") as search:
        search.return_value = []

        client.post("/retrieve", json={"query": "why redis?", "repos": ["owner/repo"]})

    search.assert_called_once_with("why redis?", k=5, repos=["owner/repo"])
