"""recall@5 eval harness — the v2 quality gate
(docs/superpowers/specs/2026-08-04-v2-design.md, "The gate").

Replays golden questions from `docs/eval-questions.md` against a frozen
fixture and reports the fraction whose expected source unit lands in the
top-5 retrieved results, ranked by cosine similarity. Deterministic: no
LLM judge, no network call, no Ollama instance — satisfies
ARCHITECTURE.md's CI testing constraints.

Gate: 70% absolute floor, below 50% is "broken", and CI fails any run
that drops more than 5 points below the best score on record.
"""

import json
import math
import sys
from pathlib import Path

from ingestion.embed import embed_text
from models import DecisionUnit

FLOOR = 0.70
BROKEN = 0.50
RATCHET_TOLERANCE = 0.05

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
BEST_SCORE_PATH = Path(__file__).resolve().parent / "best_score.json"


def embed_query(question: str) -> list[float]:
    return embed_text(question)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def compute_recall_at_5(
    golden_questions: list[dict], units: list[DecisionUnit], embeddings: list[list[float]]
) -> float:
    """Fraction of `golden_questions` whose `expected_unit_id` appears in
    the top-5 `units` ranked by cosine similarity to the embedded
    question. `units` and `embeddings` are parallel lists."""
    if not golden_questions:
        return 0.0

    hits = 0
    for golden in golden_questions:
        query_vector = embed_query(golden["question"])
        ranked = sorted(
            zip(units, embeddings),
            key=lambda pair: _cosine_similarity(query_vector, pair[1]),
            reverse=True,
        )
        top_5_ids = [unit.id for unit, _ in ranked[:5]]
        if golden["expected_unit_id"] in top_5_ids:
            hits += 1

    return hits / len(golden_questions)


def _load_golden_questions() -> list[dict]:
    from eval.docs_eval_questions import load_golden_questions

    return load_golden_questions()


def _load_fixture() -> tuple[list[DecisionUnit], list[list[float]]]:
    units_raw = json.loads((FIXTURES_DIR / "decision_units.json").read_text())
    embeddings = json.loads((FIXTURES_DIR / "embeddings.json").read_text())
    return [DecisionUnit(**unit) for unit in units_raw], embeddings


def _load_best_score() -> float | None:
    if not BEST_SCORE_PATH.exists():
        return None
    return json.loads(BEST_SCORE_PATH.read_text())["recall_at_5"]


def _record_best_score(score: float) -> None:
    BEST_SCORE_PATH.write_text(json.dumps({"recall_at_5": score}, indent=2))


def main() -> int:
    golden_questions = _load_golden_questions()
    units, embeddings = _load_fixture()

    score = compute_recall_at_5(golden_questions, units, embeddings)
    best = _load_best_score()

    print(f"recall@5: {score:.1%} ({len(golden_questions)} questions)")

    if score < BROKEN:
        print(f"BROKEN: recall@5 is below the {BROKEN:.0%} broken threshold")
        return 1

    if score < FLOOR:
        print(f"FAIL: recall@5 is below the {FLOOR:.0%} floor")
        return 1

    if best is not None and score < best - RATCHET_TOLERANCE:
        print(f"FAIL: recall@5 regressed more than {RATCHET_TOLERANCE:.0%} below the best score on record ({best:.1%})")
        return 1

    if best is None or score > best:
        _record_best_score(score)

    return 0


if __name__ == "__main__":
    sys.exit(main())
