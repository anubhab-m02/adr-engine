"""Ingestion CLI entry point, for scripting/cron use outside the API.

Usage: python -m backend.cli ingest [--repos owner/repo,owner/other]

Run from the repo root. Inserts `backend/` onto `sys.path` so it can
import sibling modules (`config`, `ingestion.run`) the same flat way
`main.py` and the test suite do; `backend` itself has no `__init__.py`
and isn't a real package.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import get_settings  # noqa: E402
from ingestion.run import run_ingestion  # noqa: E402


def _target_repos(cli_repos: str | None) -> list[str]:
    if cli_repos:
        return [repo.strip() for repo in cli_repos.split(",") if repo.strip()]
    return get_settings().indexed_repos


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m backend.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest_parser = subparsers.add_parser("ingest", help="run ingestion for one or more repos")
    ingest_parser.add_argument("--repos", help="comma-separated repos; default: all configured repos")

    args = parser.parse_args(argv)

    repos = _target_repos(args.repos)
    for repo in repos:
        result = run_ingestion(repo)
        print(
            f"{result.repo}: fetched={result.fetched} extracted={result.extracted} "
            f"skipped={result.skipped} stored={result.stored}"
        )


if __name__ == "__main__":
    main()
