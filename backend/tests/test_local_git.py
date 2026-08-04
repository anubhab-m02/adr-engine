import os
import subprocess

import pytest

from ingestion.local_git import get_commit_diff, list_commits

_AUTHOR_ENV = {
    "GIT_AUTHOR_NAME": "Tester",
    "GIT_AUTHOR_EMAIL": "tester@example.com",
    "GIT_COMMITTER_NAME": "Tester",
    "GIT_COMMITTER_EMAIL": "tester@example.com",
}


def _git(repo_path, *args, env=None):
    result = subprocess.run(
        ["git", "-C", str(repo_path), *args],
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout


def _commit_env(date: str) -> dict:
    return {**os.environ, **_AUTHOR_ENV, "GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date}


def _commit(repo_path, filename: str, content: str, message: str, date: str) -> str:
    (repo_path / filename).write_text(content)
    _git(repo_path, "add", filename)
    _git(repo_path, "commit", "-q", "-m", message, env=_commit_env(date))
    return _git(repo_path, "rev-parse", "HEAD").strip()


@pytest.fixture
def repo(tmp_path):
    _git(tmp_path, "init", "-q")
    return tmp_path


def test_list_commits_returns_newest_first_with_files_changed(repo):
    first = _commit(repo, "a.txt", "one\n", "first commit", "2026-01-01T00:00:00")
    second = _commit(repo, "b.txt", "two\n", "second commit", "2026-01-02T00:00:00")

    commits = list_commits(str(repo))

    assert [c.sha for c in commits] == [second, first]
    assert commits[0].files_changed == ["b.txt"]
    assert commits[1].files_changed == ["a.txt"]
    assert commits[0].message == "second commit"


def test_list_commits_since_filters_out_older_commits(repo):
    _commit(repo, "a.txt", "one\n", "first commit", "2026-01-01T00:00:00")
    second = _commit(repo, "b.txt", "two\n", "second commit", "2026-01-02T00:00:00")

    commits = list_commits(str(repo), since="2026-01-02T00:00:00")

    assert [c.sha for c in commits] == [second]


def test_list_commits_excludes_merge_commits(repo):
    initial_branch = _git(repo, "symbolic-ref", "--short", "HEAD").strip()
    first = _commit(repo, "a.txt", "one\n", "first commit", "2026-01-01T00:00:00")

    _git(repo, "checkout", "-q", "-b", "feature")
    second = _commit(repo, "b.txt", "two\n", "second commit on feature", "2026-01-02T00:00:00")

    _git(repo, "checkout", "-q", initial_branch)
    third = _commit(repo, "c.txt", "three\n", "third commit on main", "2026-01-03T00:00:00")

    _git(
        repo,
        "merge",
        "--no-ff",
        "-m",
        "Merge feature",
        "feature",
        env=_commit_env("2026-01-04T00:00:00"),
    )

    commits = list_commits(str(repo))

    assert [c.sha for c in commits] == [third, second, first]


def test_get_commit_diff_returns_unified_diff_text(repo):
    first = _commit(repo, "a.txt", "one\n", "first commit", "2026-01-01T00:00:00")

    diff = get_commit_diff(str(repo), first)

    assert "diff --git a/a.txt b/a.txt" in diff
    assert "+one" in diff
