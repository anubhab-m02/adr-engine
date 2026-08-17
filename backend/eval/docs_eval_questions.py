"""Parses golden questions directly out of docs/eval-questions.md's
Markdown tables, rather than duplicating them into a second
machine-readable file — keeps the golden set in exactly one place so it
can't drift out of sync with the human-readable doc.
"""

import re
from pathlib import Path

EVAL_QUESTIONS_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "eval-questions.md"

_COMMIT_CELL = re.compile(
    r"`([^`]+)`\s+commit\s+\[`[0-9a-fA-F]+`\]\(https://github\.com/[^)]+/commit/([0-9a-fA-F]+)\)"
)
_PR_CELL = re.compile(r"`([^`]+)`\s+PR\s+\[#(\d+)\]\(https://github\.com/[^)]+/pull/\d+\)")


def _parse_expected_unit_id(source_cell: str) -> str | None:
    commit_match = _COMMIT_CELL.search(source_cell)
    if commit_match:
        repo, sha = commit_match.groups()
        return f"{repo}:commit:{sha}"

    pr_match = _PR_CELL.search(source_cell)
    if pr_match:
        repo, number = pr_match.groups()
        return f"{repo}:pr:{number}"

    return None


def load_golden_questions(path: Path = EVAL_QUESTIONS_PATH) -> list[dict]:
    """Parse every `| # | Question | Expected source | Why |` row across
    all tables in `path` into `{"question": ..., "expected_unit_id": ...}`
    pairs, skipping header/separator rows and any row whose source cell
    doesn't match a recognized commit/PR shape."""
    questions = []

    for line in path.read_text().splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue

        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != 4 or not cells[0].isdigit():
            continue

        _, question, source_cell, _why = cells
        expected_unit_id = _parse_expected_unit_id(source_cell)
        if expected_unit_id is None:
            continue

        questions.append({"question": question, "expected_unit_id": expected_unit_id})

    return questions
