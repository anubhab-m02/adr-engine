"""Local git transport: commit listing and diff fetch via the `git` CLI.

Reads commit history and diffs from a local clone instead of the GitHub
API — no token, no rate limit, no network, works offline and on repos
not hosted on GitHub at all. Uses `subprocess` against the system `git`,
not a library like GitPython.
"""

import subprocess

from ingestion.github_client import CommitRef

_FIELD_SEP = "\x1f"
_RECORD_SEP = "\x1e"
_LOG_FORMAT = f"%H{_FIELD_SEP}%an{_FIELD_SEP}%aI{_FIELD_SEP}%B{_RECORD_SEP}"


class LocalGitError(Exception):
    pass


def _run_git(repo_path: str, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", repo_path, *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise LocalGitError(result.stderr.strip())
    return result.stdout


def _files_changed(repo_path: str, sha: str) -> list[str]:
    output = _run_git(
        repo_path, "diff-tree", "--no-commit-id", "--name-only", "--root", "-r", sha
    )
    return [line for line in output.splitlines() if line]


def list_commits(repo_path: str, since: str | None = None) -> list[CommitRef]:
    """Commits newest-first, excluding merge commits. `since` filters to
    commits authored on or after that date (any format `git log --since`
    accepts, e.g. an ISO 8601 timestamp)."""
    args = ["log", "--no-merges", f"--format={_LOG_FORMAT}"]
    if since:
        args.append(f"--since={since}")

    output = _run_git(repo_path, *args)
    records = [record for record in output.split(f"{_RECORD_SEP}\n") if record]

    commits = []
    for record in records:
        sha, author, date, message = record.split(_FIELD_SEP, 3)
        commits.append(
            CommitRef(
                sha=sha,
                message=message.removesuffix("\n"),
                author=author,
                date=date,
                url="",
                files_changed=_files_changed(repo_path, sha),
            )
        )

    return commits


def get_commit_diff(repo_path: str, sha: str) -> str:
    """Unified diff text for `sha`, root-commit safe (diffed against an
    empty tree when it has no parent)."""
    return _run_git(repo_path, "diff-tree", "--no-commit-id", "-p", "--root", sha)
