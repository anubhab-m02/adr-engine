"""Builds the frozen recall@5 eval fixture (issue #108).

Runs real ingestion into a throwaway Chroma dir (never touches your real
index), then dumps what the harness replays offline:
  fixtures/decision_units.json, embeddings.json,
  golden_question_embeddings.json

Needs a live local Ollama (extraction + embeddings). One-time, human-run;
CI only ever replays the output.

  python -m eval.build_fixture \\
      --repo anubhab-m02/BuFin --local-path /path/to/BuFin \\
      --repo anubhab-m02/adr-engine          # no path = GitHub (needs GITHUB_TOKEN)
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", action="append", required=True, help="owner/repo (repeatable)")
    parser.add_argument(
        "--local-path",
        action="append",
        default=[],
        help="local clone for the Nth --repo (repeatable; repos beyond the last path use the GitHub API)",
    )
    parser.add_argument("--data-dir", help="reuse a scratch dir to resume an interrupted build (the ingest cursor picks up where it stopped)")
    args = parser.parse_args(argv)

    scratch = args.data_dir or tempfile.mkdtemp(prefix="adr-fixture-")
    print(f"scratch dir: {scratch}", flush=True)
    os.environ["CHROMA_DATA_DIR"] = scratch
    # Large diffs routinely exceed the 60s default on a laptop-sized model.
    os.environ.setdefault("OLLAMA_REQUEST_TIMEOUT_SECONDS", "300")
    os.environ.setdefault("GITHUB_REQUEST_TIMEOUT_SECONDS", "60")

    # Imported after CHROMA_DATA_DIR is set: settings are cached on first use.
    import config_store
    from eval.docs_eval_questions import load_golden_questions
    from ingestion import run, store
    from ingestion.embed import embed_text

    for repo, path in zip(args.repo, args.local_path):
        config_store.set_local_repo_path(repo, str(Path(path).expanduser().resolve()))

    from ingestion.extract import ExtractionError
    from ingestion.github_client import GitHubError

    for repo in args.repo:
        print(f"ingesting {repo} ...", flush=True)
        for attempt in range(1, 6):
            try:
                print(f"  {run.run_ingestion(repo)}", flush=True)
                break
            except (ExtractionError, GitHubError) as exc:
                # The cursor advances per item, so a retry resumes after the last good one.
                print(f"  attempt {attempt} hit {exc}; retrying", flush=True)
        else:
            print(f"ERROR: gave up on {repo}", file=sys.stderr)
            return 1

    got = store.get_collection().get(include=["metadatas", "embeddings"])
    rows = sorted(zip(got["ids"], got["metadatas"], got["embeddings"]), key=lambda r: r[0])
    units = [store._unit_from_metadata(i, m) for i, m, _ in rows]
    embeddings = [[float(x) for x in e] for _, _, e in rows]
    if not units:
        print("ERROR: ingestion produced zero units — check Ollama and the repo paths.", file=sys.stderr)
        return 1

    golden = load_golden_questions()
    unit_ids = {u.id for u in units}
    missing = [g for g in golden if g["expected_unit_id"] not in unit_ids]
    print(f"{len(units)} units; {len(golden) - len(missing)}/{len(golden)} golden questions have their expected unit in the corpus")
    for g in missing:
        print(f"  MISSING {g['expected_unit_id']}  <- {g['question'][:70]}")

    query_embeddings = {g["question"]: embed_text(g["question"]) for g in golden}

    FIXTURES_DIR.mkdir(exist_ok=True)
    (FIXTURES_DIR / "decision_units.json").write_text(json.dumps([u.model_dump() for u in units], indent=1))
    (FIXTURES_DIR / "embeddings.json").write_text(json.dumps(embeddings))
    (FIXTURES_DIR / "golden_question_embeddings.json").write_text(json.dumps(query_embeddings))
    print(f"wrote fixtures to {FIXTURES_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
