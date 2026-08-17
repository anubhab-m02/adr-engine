"""Ingestion orchestrator: fetch -> extract -> embed -> store, per repo.

Per-item fault-tolerant (a commit/PR the extractor can't parse, or that
isn't a decision, is skipped and counted); per-run fail-loud (GitHub or
Ollama being unreachable propagates and aborts the run without advancing
the cursor), per ARCHITECTURE.md's error-handling conventions.

Transport selection: a repo mapped to a local clone path (via
`config_store.set_local_repo_path`) is ingested through `local_git`
instead of the GitHub API — no token, no rate limit, no network. Local
git has no concept of pull requests, so PRs are only fetched for
GitHub-transport repos.

The cursor is persisted after every processed commit/PR, not once at the
end, so a mid-run crash loses at most the single in-flight item instead
of the whole run's progress.
"""

from typing import Callable

import config_store
from ingestion import diff_filter, embed, extract, github_client, local_git, store
from ingestion.github_client import CommitRef, PullRequestRef
from models import DecisionUnit, IngestCounts, IngestResult


def _split_commit_message(message: str) -> tuple[str, str]:
    title, _, rest = message.partition("\n")
    return title, rest.strip()


def _commit_unit(repo: str, commit: CommitRef, result: extract.ExtractionResult) -> DecisionUnit:
    return DecisionUnit(
        id=f"{repo}:commit:{commit.sha}",
        repo=repo,
        kind="commit",
        ref=commit.sha,
        url=commit.url,
        author=commit.author,
        date=commit.date,
        title=_split_commit_message(commit.message)[0],
        decision=result.decision,
        rationale=result.rationale,
        alternatives=result.alternatives,
        source_excerpt=commit.message.strip(),
        files_changed=commit.files_changed,
    )


def _pr_body(pr: PullRequestRef) -> str:
    return "\n\n".join([pr.body, *pr.review_comments]).strip()


def _pr_unit(repo: str, pr: PullRequestRef, body: str, result: extract.ExtractionResult) -> DecisionUnit:
    return DecisionUnit(
        id=f"{repo}:pr:{pr.number}",
        repo=repo,
        kind="pr",
        ref=str(pr.number),
        url=pr.url,
        author=pr.author,
        date=pr.merged_at or "",
        title=pr.title,
        decision=result.decision,
        rationale=result.rationale,
        alternatives=result.alternatives,
        source_excerpt=body,
    )


def _commit_diff(repo: str, commit: CommitRef, local_path: str | None) -> str:
    raw_diff = (
        local_git.get_commit_diff(local_path, commit.sha)
        if local_path
        else github_client.get_commit_diff(repo, commit.sha)
    )

    # GitHub's commit-list endpoint doesn't return file names (local_git
    # already populates this from `git diff-tree` in list_commits), so
    # derive it here from the diff already being fetched rather than an
    # extra per-commit API call.
    if not commit.files_changed:
        commit.files_changed = diff_filter.extract_changed_files(raw_diff)

    return diff_filter.filter_diff(raw_diff)


def _record_progress(
    is_decision: bool,
    counts: IngestCounts,
    on_progress: Callable[[IngestCounts], None] | None,
) -> None:
    counts.fetched += 1
    if is_decision:
        counts.extracted += 1
        counts.stored += 1
    else:
        counts.skipped += 1

    if on_progress:
        on_progress(counts)


def _process_items(
    repo: str,
    items: list,
    title_body_diff: Callable[[object], tuple[str, str, str]],
    build_unit: Callable[[object, str, extract.ExtractionResult], DecisionUnit],
    update_cursor: Callable[[dict, object], None],
    cursor: dict,
    counts: IngestCounts,
    on_progress: Callable[[IngestCounts], None] | None,
) -> None:
    """Shared extract -> embed -> store -> progress -> cursor loop for
    both commits and PRs; only how to get (title, body, diff), how to
    build a unit, and how to advance the cursor differ per item kind."""
    for item in items:
        title, body, diff = title_body_diff(item)
        result = extract.extract_decision(title, body, diff=diff)
        is_decision = result is not None and result.is_decision

        if is_decision:
            vector = embed.embed_text(result.decision)
            unit = build_unit(item, body, result)
            store.upsert_units([unit], embeddings=[vector])

        _record_progress(is_decision, counts, on_progress)

        update_cursor(cursor, item)
        store.set_cursor(repo, dict(cursor))


def _process_commits(
    repo: str,
    commits: list[CommitRef],
    local_path: str | None,
    cursor: dict,
    counts: IngestCounts,
    on_progress: Callable[[IngestCounts], None] | None,
) -> None:
    def title_body_diff(commit: CommitRef) -> tuple[str, str, str]:
        title, body = _split_commit_message(commit.message)
        return title, body, _commit_diff(repo, commit, local_path)

    def update_cursor(cursor: dict, commit: CommitRef) -> None:
        last_date = cursor.get("last_commit_date")
        if last_date is None or commit.date > last_date:
            cursor["last_commit_date"] = commit.date

    _process_items(
        repo,
        commits,
        title_body_diff,
        build_unit=lambda commit, _body, result: _commit_unit(repo, commit, result),
        update_cursor=update_cursor,
        cursor=cursor,
        counts=counts,
        on_progress=on_progress,
    )


def _process_prs(
    repo: str,
    prs: list[PullRequestRef],
    cursor: dict,
    counts: IngestCounts,
    on_progress: Callable[[IngestCounts], None] | None,
) -> None:
    def title_body_diff(pr: PullRequestRef) -> tuple[str, str, str]:
        return pr.title, _pr_body(pr), ""

    def update_cursor(cursor: dict, pr: PullRequestRef) -> None:
        last_date = cursor.get("last_pr_updated_at")
        if pr.merged_at and (last_date is None or pr.merged_at > last_date):
            cursor["last_pr_updated_at"] = pr.merged_at

    _process_items(
        repo,
        prs,
        title_body_diff,
        build_unit=lambda pr, body, result: _pr_unit(repo, pr, body, result),
        update_cursor=update_cursor,
        cursor=cursor,
        counts=counts,
        on_progress=on_progress,
    )


def run_ingestion(repo: str, on_progress: Callable[[IngestCounts], None] | None = None) -> IngestResult:
    cursor = store.get_cursor(repo)
    local_path = config_store.get_local_repo_path(repo)
    counts = IngestCounts()

    if local_path:
        commits = local_git.list_commits(local_path, since=cursor.get("last_commit_date"))
        prs: list[PullRequestRef] = []
    else:
        commits = github_client.list_commits(repo, since=cursor.get("last_commit_date"))
        prs = github_client.list_prs(repo, since=cursor.get("last_pr_updated_at"))

    _process_commits(repo, commits, local_path, cursor, counts, on_progress)
    _process_prs(repo, prs, cursor, counts, on_progress)

    return IngestResult(
        repo=repo,
        fetched=counts.fetched,
        extracted=counts.extracted,
        skipped=counts.skipped,
        stored=counts.stored,
    )
