from models import DecisionUnit


def test_sample_decision_unit_is_a_valid_decision_unit(sample_decision_unit):
    assert isinstance(sample_decision_unit, DecisionUnit)
    assert sample_decision_unit.repo == "octocat/Hello-World"


def test_tmp_chroma_client_is_usable(tmp_chroma_client):
    collection = tmp_chroma_client.get_or_create_collection(name="decisions")
    assert collection.count() == 0


def test_load_fixture_parses_json_files(load_fixture):
    commit = load_fixture("github_commit.json")
    assert commit["sha"] == "6dcb09b5b57875f334f61aebed695e2e4193db5"

    pr = load_fixture("github_pr.json")
    assert pr["number"] == 42

    extraction_ok = load_fixture("extraction_ok.json")
    assert extraction_ok["title"] == "Switch auth to session tokens"

    extraction_skip = load_fixture("extraction_skip.json")
    assert extraction_skip["is_decision"] is False


def test_load_fixture_returns_raw_text_for_non_json_files(load_fixture):
    malformed = load_fixture("extraction_malformed.txt")
    assert isinstance(malformed, str)
    assert "{" in malformed
