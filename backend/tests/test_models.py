import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import ValidationError

from models import (
    DecisionUnit,
    IngestRequest,
    IngestResponse,
    IngestResult,
    QueryRequest,
    QueryResponse,
    RepoInfo,
    ReposResponse,
    RetrieveRequest,
    RetrieveResponse,
    RetrieveResult,
)


def make_decision_unit(**overrides) -> DecisionUnit:
    fields = {
        "id": "anubhab-m02/BuFin:pr:42",
        "repo": "anubhab-m02/BuFin",
        "kind": "pr",
        "ref": "42",
        "url": "https://github.com/anubhab-m02/BuFin/pull/42",
        "author": "anubhab-m02",
        "date": "2026-01-01T00:00:00Z",
        "title": "Switch auth to session tokens",
        "decision": "Use server-side session tokens instead of JWTs",
        "rationale": "JWTs couldn't be revoked without a blocklist",
        "alternatives": ["JWT with blocklist", "opaque tokens via Redis"],
        "source_excerpt": "We discussed JWT revocation and decided against it.",
    }
    fields.update(overrides)
    return DecisionUnit(**fields)


def test_decision_unit_round_trips_through_json():
    unit = make_decision_unit()

    restored = DecisionUnit.model_validate_json(unit.model_dump_json())

    assert restored == unit


def test_decision_unit_rejects_invalid_kind():
    with pytest.raises(ValidationError):
        make_decision_unit(kind="issue")


def test_ingest_models_round_trip():
    response = IngestResponse(
        repos=[
            IngestResult(repo="owner/repo", fetched=10, extracted=8, skipped=2, stored=8)
        ]
    )

    restored = IngestResponse.model_validate_json(response.model_dump_json())

    assert restored == response
    assert IngestRequest().repo is None
    assert IngestRequest(repo="owner/repo").repo == "owner/repo"


def test_retrieve_models_round_trip():
    unit = make_decision_unit()
    response = RetrieveResponse(results=[RetrieveResult(unit=unit, score=0.87)])

    restored = RetrieveResponse.model_validate_json(response.model_dump_json())

    assert restored == response
    assert RetrieveRequest(query="why session tokens?").k == 5
    assert RetrieveRequest(query="why session tokens?", repos=["owner/repo"]).repos == [
        "owner/repo"
    ]


def test_query_models_round_trip():
    unit = make_decision_unit()
    response = QueryResponse(answer="Because of revocation.", citations=[unit], retrieved_count=1)

    restored = QueryResponse.model_validate_json(response.model_dump_json())

    assert restored == response
    assert QueryRequest(question="why session tokens?").repos is None


def test_repos_response_round_trips():
    response = ReposResponse(repos=[RepoInfo(repo="owner/repo", indexed_units=3)])

    restored = ReposResponse.model_validate_json(response.model_dump_json())

    assert restored == response
