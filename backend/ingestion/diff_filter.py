"""Diff filtering: drop lockfile/generated/vendored noise, cap remaining size.

Runs on a unified diff before it reaches extraction so the local model
never sees lockfile churn or multi-thousand-line diffs. Cap sized off
BuFin's own measured diff distribution (median 45 lines, p90 361, max
3,140 over its last 100 commits): 400 lines total, keeping the first 300
and last 100 with the omitted count stated inline.

Each section's path is read from its own `diff --git a/<path> b/<path>`
header rather than a separately-passed file list — a caller whose file
list is empty, short, or differently ordered than the diff's own
sections would otherwise silently drop every hunk (positional zip
against a shorter/empty list yields nothing).
"""

import fnmatch
import re

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

_DIFF_HEADER = re.compile(r"^diff --git a/.+ b/(?P<path>.+)$")


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


def _section_path(section: str) -> str | None:
    first_line = section.splitlines()[0] if section else ""
    match = _DIFF_HEADER.match(first_line)
    return match.group("path") if match else None


def extract_changed_files(raw_diff: str) -> list[str]:
    """Paths touched by `raw_diff`, read from each section's own header.

    Used to populate `CommitRef.files_changed` for transports (the
    GitHub API's commit-list endpoint) whose list response doesn't
    include file names up front.
    """
    return [path for path in (_section_path(section) for section in _split_file_sections(raw_diff)) if path]


def _cap_size(text: str) -> str:
    lines = text.splitlines()
    if len(lines) <= _MAX_LINES:
        return text

    head = lines[:_HEAD_LINES]
    tail = lines[-_TAIL_LINES:]
    omitted = len(lines) - _HEAD_LINES - _TAIL_LINES
    marker = f"... [{omitted} lines omitted] ..."

    return "\n".join([*head, marker, *tail])


def filter_diff(raw_diff: str) -> str:
    """Drop hunks for excluded paths, then cap the remaining size."""
    sections = _split_file_sections(raw_diff)
    kept = [section for section in sections if not _is_excluded(_section_path(section) or "")]

    return _cap_size("".join(kept))
