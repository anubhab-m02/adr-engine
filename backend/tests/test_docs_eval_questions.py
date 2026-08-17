import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from eval.docs_eval_questions import load_golden_questions


def test_loads_at_least_fourteen_questions():
    questions = load_golden_questions()

    assert len(questions) >= 14


def test_every_question_has_a_question_string_and_a_repo_kind_ref_shaped_id():
    questions = load_golden_questions()

    for entry in questions:
        assert entry["question"]
        repo, kind, ref = entry["expected_unit_id"].split(":", 2)
        assert repo
        assert kind in {"commit", "pr"}
        assert ref


def test_utc_timestamp_question_parses_to_the_exact_expected_full_sha():
    questions = load_golden_questions()

    utc_question = next(q for q in questions if "UTC timestamps" in q["question"])

    assert (
        utc_question["expected_unit_id"]
        == "anubhab-m02/BuFin:commit:b4cc4d153cd26ef04b272e4839aa7a8274e4a586"
    )


def test_parses_commit_and_pr_rows_from_a_synthetic_table(tmp_path):
    doc = tmp_path / "eval-questions.md"
    doc.write_text(
        "# Golden evaluation questions\n\n"
        "## Fixture questions\n\n"
        "| # | Question | Expected source | Why |\n"
        "|---|---|---|---|\n"
        "| 1 | Why commit? | `owner/repo` commit "
        "[`abc12345`](https://github.com/owner/repo/commit/abc123456789def) | because |\n"
        "| 2 | Why PR? | `owner/repo` PR [#7](https://github.com/owner/repo/pull/7) | because |\n"
    )

    questions = load_golden_questions(doc)

    assert questions == [
        {"question": "Why commit?", "expected_unit_id": "owner/repo:commit:abc123456789def"},
        {"question": "Why PR?", "expected_unit_id": "owner/repo:pr:7"},
    ]


def test_skips_header_separator_and_unrecognized_source_rows(tmp_path):
    doc = tmp_path / "eval-questions.md"
    doc.write_text(
        "## Fixture questions\n\n"
        "| # | Question | Expected source | Why |\n"
        "|---|---|---|---|\n"
        "| 1 | Has a real source | `owner/repo` commit "
        "[`abc12345`](https://github.com/owner/repo/commit/abc123456789def) | because |\n"
        "| 2 | No parseable source | just some prose, no link | because |\n"
    )

    questions = load_golden_questions(doc)

    assert questions == [
        {"question": "Has a real source", "expected_unit_id": "owner/repo:commit:abc123456789def"}
    ]
