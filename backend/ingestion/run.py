"""Ingestion orchestrator: fetch -> extract -> embed -> store, per repo.

Per-item fault-tolerant (a commit/PR the extractor can't parse, or that
isn't a decision, is skipped and counted); per-run fail-loud (GitHub or
Ollama being unreachable propagates and aborts the run without advancing
the cursor), per ARCHITECTURE.md's error-handling conventions.
"""

from typing import Callable

from ingestion import embed, extract, github_client, store
from ingestion.github_client import CommitRef, PullRequestRef
from models import DecisionUnit, IngestResult


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


def _ingest_items(
    items: list,
    title_body: Callable[[object], tuple[str, str]],
    build_unit: Callable[[object, str, extract.ExtractionResult], DecisionUnit],
) -> tuple[int, int, list[DecisionUnit]]:
    extracted = 0
    skipped = 0
    units: list[DecisionUnit] = []

    for item in items:
        title, body = title_body(item)
        result = extract.extract_decision(title, body)
        if result is None or not result.is_decision:
            skipped += 1
            continue

        extracted += 1
        vector = embed.embed_text(result.decision)
        unit = build_unit(item, body, result)
        store.upsert_units([unit], embeddings=[vector])
        units.append(unit)

    return extracted, skipped, units


def run_ingestion(repo: str, on_phase: Callable[[str], None] | None = None) -> IngestResult:
    """`on_phase`, if given, is called once with `"extracting"` when
    fetching finishes and the extract/embed/store loop begins — the only
    real phase boundary this per-item pipeline has (extraction and
    embedding happen interleaved per item, not as separate passes)."""
    cursor = store.get_cursor(repo)

    commits = github_client.list_commits(repo, since=cursor.get("last_commit_date"))
    prs = github_client.list_prs(repo, since=cursor.get("last_pr_updated_at"))

    if on_phase:
        on_phase("extracting")

    commit_extracted, commit_skipped, commit_units = _ingest_items(
        commits,
        title_body=lambda commit: _split_commit_message(commit.message),
        build_unit=lambda commit, _body, result: _commit_unit(repo, commit, result),
    )
    pr_extracted, pr_skipped, pr_units = _ingest_items(
        prs,
        title_body=lambda pr: (pr.title, _pr_body(pr)),
        build_unit=lambda pr, body, result: _pr_unit(repo, pr, body, result),
    )

    new_cursor = dict(cursor)
    if commits:
        new_cursor["last_commit_date"] = max(commit.date for commit in commits)
    pr_dates = [pr.merged_at for pr in prs if pr.merged_at]
    if pr_dates:
        new_cursor["last_pr_updated_at"] = max(pr_dates)
    store.set_cursor(repo, new_cursor)

    return IngestResult(
        repo=repo,
        fetched=len(commits) + len(prs),
        extracted=commit_extracted + pr_extracted,
        skipped=commit_skipped + pr_skipped,
        stored=len(commit_units) + len(pr_units),
    )
