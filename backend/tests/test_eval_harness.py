import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from eval import harness


def test_recall_is_one_when_expected_unit_ranks_first(monkeypatch, make_unit):
    hit_unit = make_unit(id="owner/repo:commit:aaa")
    other_unit = make_unit(id="owner/repo:commit:bbb")
    units = [hit_unit, other_unit]
    embeddings = [[1.0, 0.0], [0.0, 1.0]]
    golden_questions = [{"question": "why aaa", "expected_unit_id": "owner/repo:commit:aaa"}]

    monkeypatch.setattr(harness, "embed_query", lambda question: [1.0, 0.0])

    assert harness.compute_recall_at_5(golden_questions, units, embeddings) == 1.0


def test_recall_is_zero_when_expected_unit_is_never_in_top_5(monkeypatch, make_unit):
    distractors = [
        make_unit(id=f"owner/repo:commit:d{i}") for i in range(5)
    ]
    miss_unit = make_unit(id="owner/repo:commit:zzz")
    units = distractors + [miss_unit]
    embeddings = [[1.0, 0.1 * (i + 1)] for i in range(5)] + [[-1.0, 0.0]]
    golden_questions = [{"question": "why zzz", "expected_unit_id": "owner/repo:commit:zzz"}]

    monkeypatch.setattr(harness, "embed_query", lambda question: [1.0, 0.0])

    assert harness.compute_recall_at_5(golden_questions, units, embeddings) == 0.0


def test_recall_averages_correctly_across_multiple_questions(monkeypatch, make_unit):
    hit_unit = make_unit(id="owner/repo:commit:hit")
    distractors = [
        make_unit(id=f"owner/repo:commit:d{i}") for i in range(4)
    ]
    miss_unit = make_unit(id="owner/repo:commit:miss")
    units = [hit_unit] + distractors + [miss_unit]
    embeddings = [[1.0, 0.0]] + [[0.9 - 0.1 * i, 0.1 + 0.1 * i] for i in range(4)] + [[-1.0, 0.0]]
    golden_questions = [
        {"question": "hit question", "expected_unit_id": "owner/repo:commit:hit"},
        {"question": "miss question", "expected_unit_id": "owner/repo:commit:miss"},
    ]

    monkeypatch.setattr(harness, "embed_query", lambda question: [1.0, 0.0])

    assert harness.compute_recall_at_5(golden_questions, units, embeddings) == 0.5


def test_recall_is_zero_for_empty_golden_questions(make_unit):
    units = [make_unit(id="owner/repo:commit:aaa")]
    embeddings = [[1.0, 0.0]]

    assert harness.compute_recall_at_5([], units, embeddings) == 0.0


@pytest.fixture
def _isolated_best_score(tmp_path, monkeypatch):
    monkeypatch.setattr(harness, "BEST_SCORE_PATH", tmp_path / "best_score.json")


def _stub_gate_inputs(monkeypatch, golden_questions, units, embeddings):
    monkeypatch.setattr(harness, "_load_golden_questions", lambda: golden_questions)
    monkeypatch.setattr(harness, "_load_fixture", lambda: (units, embeddings))
    monkeypatch.setattr(harness, "embed_query", lambda question: [1.0, 0.0])


def _six_unit_fixture(make_unit):
    """1 unit that always ranks first, 4 middling distractors, and 1 unit
    that always ranks last (6th) — so a question expecting the last unit
    is guaranteed a miss against top-5, while one expecting the first is
    guaranteed a hit."""
    hit_unit = make_unit(id="owner/repo:commit:hit")
    distractors = [make_unit(id=f"owner/repo:commit:d{i}") for i in range(4)]
    miss_unit = make_unit(id="owner/repo:commit:miss")
    units = [hit_unit] + distractors + [miss_unit]
    embeddings = [[1.0, 0.0]] + [[0.9 - 0.1 * i, 0.1 + 0.1 * i] for i in range(4)] + [[-1.0, 0.0]]
    return units, embeddings


def test_main_exits_zero_and_records_best_score_when_at_floor(monkeypatch, make_unit, _isolated_best_score):
    units, embeddings = _six_unit_fixture(make_unit)
    _stub_gate_inputs(
        monkeypatch,
        golden_questions=[{"question": "q", "expected_unit_id": "owner/repo:commit:hit"}],
        units=units,
        embeddings=embeddings,
    )

    assert harness.main() == 0
    assert harness._load_best_score() == 1.0


def test_main_exits_nonzero_when_below_floor(monkeypatch, make_unit, _isolated_best_score):
    units, embeddings = _six_unit_fixture(make_unit)
    _stub_gate_inputs(
        monkeypatch,
        golden_questions=[
            {"question": "q1", "expected_unit_id": "owner/repo:commit:hit"},
            {"question": "q2", "expected_unit_id": "owner/repo:commit:miss"},
            {"question": "q3", "expected_unit_id": "owner/repo:commit:miss"},
            {"question": "q4", "expected_unit_id": "owner/repo:commit:miss"},
        ],
        units=units,
        embeddings=embeddings,
    )

    assert harness.main() == 1
    assert harness._load_best_score() is None


def test_main_exits_nonzero_on_ratchet_regression(monkeypatch, make_unit, _isolated_best_score):
    units, embeddings = _six_unit_fixture(make_unit)
    harness.BEST_SCORE_PATH.write_text('{"recall_at_5": 1.0}')
    _stub_gate_inputs(
        monkeypatch,
        golden_questions=[
            {"question": "q1", "expected_unit_id": "owner/repo:commit:hit"},
            {"question": "q2", "expected_unit_id": "owner/repo:commit:hit"},
            {"question": "q3", "expected_unit_id": "owner/repo:commit:hit"},
            {"question": "q4", "expected_unit_id": "owner/repo:commit:miss"},
        ],
        units=units,
        embeddings=embeddings,
    )

    # recall@5 here is 0.75: above the 70% floor, but more than 5 points
    # below the 1.0 best score on record.
    assert harness.main() == 1
    assert harness._load_best_score() == 1.0
