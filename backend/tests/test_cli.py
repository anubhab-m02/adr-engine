import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cli
from models import IngestResult


def _fake_result(repo: str) -> IngestResult:
    return IngestResult(repo=repo, fetched=1, extracted=1, skipped=0, stored=1)


def test_ingest_with_explicit_repos_calls_orchestrator_for_each():
    with patch("cli.run_ingestion", side_effect=_fake_result) as mock_run:
        cli.main(["ingest", "--repos", "owner/a,owner/b"])

    assert [call.args[0] for call in mock_run.call_args_list] == ["owner/a", "owner/b"]


def test_ingest_without_repos_flag_defaults_to_configured_repos():
    with patch("cli.run_ingestion", side_effect=_fake_result) as mock_run:
        cli.main(["ingest"])

    assert [call.args[0] for call in mock_run.call_args_list] == ["owner/repo"]


def test_ingest_strips_whitespace_around_comma_separated_repos():
    with patch("cli.run_ingestion", side_effect=_fake_result) as mock_run:
        cli.main(["ingest", "--repos", " owner/a , owner/b "])

    assert [call.args[0] for call in mock_run.call_args_list] == ["owner/a", "owner/b"]


def test_ingest_prints_a_summary_line_per_repo(capsys):
    with patch("cli.run_ingestion", side_effect=_fake_result):
        cli.main(["ingest", "--repos", "owner/a"])

    out = capsys.readouterr().out
    assert "owner/a: fetched=1 extracted=1 skipped=0 stored=1" in out
