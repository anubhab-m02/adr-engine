import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))


def test_all_false_on_a_fresh_config_store():
    response = client.get("/setup/state")

    assert response.status_code == 200
    assert response.json() == {
        "github_connected": False,
        "repos_selected": False,
        "first_index_done": False,
        "gemini_key_set": False,
    }


def test_github_connected_flips_once_a_token_is_stored():
    import config_store

    config_store.save({"github_token": "ghp_abc"})

    assert client.get("/setup/state").json()["github_connected"] is True


def test_repos_selected_flips_once_repos_are_configured():
    import config_store

    config_store.save({"indexed_repos": ["owner/repo"]})

    assert client.get("/setup/state").json()["repos_selected"] is True


def test_gemini_key_set_flips_once_a_key_is_stored():
    import config_store

    config_store.save({"gemini_api_key": "gk_abc"})

    assert client.get("/setup/state").json()["gemini_key_set"] is True


def test_first_index_done_flips_once_a_configured_repo_has_indexed_units():
    import config_store

    config_store.save({"indexed_repos": ["owner/repo"]})

    with patch("routers.setup.count_units", return_value=3):
        response = client.get("/setup/state")

    assert response.json()["first_index_done"] is True


def test_first_index_done_stays_false_when_configured_repos_have_no_units():
    import config_store

    config_store.save({"indexed_repos": ["owner/repo"]})

    with patch("routers.setup.count_units", return_value=0):
        response = client.get("/setup/state")

    assert response.json()["first_index_done"] is False
