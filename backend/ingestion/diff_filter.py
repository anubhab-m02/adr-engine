"""Diff filtering: drop lockfile/generated/vendored noise, cap remaining size.

Runs on a unified diff before it reaches extraction so the local model
never sees lockfile churn or multi-thousand-line diffs. Cap sized off
BuFin's own measured diff distribution (median 45 lines, p90 361, max
3,140 over its last 100 commits): 400 lines total, keeping the first 300
and last 100 with the omitted count stated inline.
"""

import fnmatch

_EXCLUDED_PATTERNS = [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "poetry.lock",
    "go.sum",
    "*.min.js",
    "*.min.css",
    "dist/*",
    "build/*",
    "node_modules/*",
    "vendor/*",
]

# Every pattern also gets a nested equivalent so an excluded path matches
# regardless of which subdirectory it lives under (e.g. a lockfile inside
# a frontend/ subpackage).
_ALL_PATTERNS = _EXCLUDED_PATTERNS + [f"*/{pattern}" for pattern in _EXCLUDED_PATTERNS]

_MAX_LINES = 400
_HEAD_LINES = 300
_TAIL_LINES = 100


def _is_excluded(path: str) -> bool:
    return any(fnmatch.fnmatch(path, pattern) for pattern in _ALL_PATTERNS)


def _split_file_sections(raw_diff: str) -> list[str]:
    """Split a multi-file unified diff into one chunk per `diff --git` section."""
    if not raw_diff:
        return []

    lines = raw_diff.splitlines(keepends=True)
    sections: list[str] = []
    current: list[str] = []

    for line in lines:
        if line.startswith("diff --git ") and current:
            sections.append("".join(current))
            current = []
        current.append(line)

    if current:
        sections.append("".join(current))

    return sections


def _cap_size(text: str) -> str:
    lines = text.splitlines()
    if len(lines) <= _MAX_LINES:
        return text

    head = lines[:_HEAD_LINES]
    tail = lines[-_TAIL_LINES:]
    omitted = len(lines) - _HEAD_LINES - _TAIL_LINES
    marker = f"... [{omitted} lines omitted] ..."

    return "\n".join([*head, marker, *tail])


def filter_diff(raw_diff: str, changed_files: list[str]) -> str:
    """Drop hunks for excluded paths, then cap the remaining size.

    `changed_files` gives the path for each `diff --git` section in
    `raw_diff`, in order (as returned by `list_commits`/`get_commit_diff`).
    """
    sections = _split_file_sections(raw_diff)
    kept = [
        section
        for section, path in zip(sections, changed_files)
        if not _is_excluded(path)
    ]

    return _cap_size("".join(kept))
