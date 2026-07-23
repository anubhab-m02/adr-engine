import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

import routers.auth as auth_router_module
from auth.device_flow import DeviceCodeResponse, PollResult
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))
    auth_router_module._pending = None


def test_start_returns_the_device_code_payload():
    payload = DeviceCodeResponse(
        device_code="devcode123",
        user_code="WDJB-MJHT",
        verification_uri="https://github.com/login/device",
        expires_in=900,
        interval=5,
    )

    with patch("routers.auth.start_device_flow", return_value=payload):
        response = client.post("/auth/github/device/start")

    assert response.status_code == 200
    assert response.json() == {
        "user_code": "WDJB-MJHT",
        "verification_uri": "https://github.com/login/device",
        "expires_in": 900,
        "interval": 5,
    }
    assert "device_code" not in response.text


def test_status_without_a_started_flow_or_existing_token_returns_400():
    response = client.get("/auth/github/status")

    assert response.status_code == 400


def test_status_reflects_pending_authorized_expired_and_denied():
    payload = DeviceCodeResponse(
        device_code="devcode123",
        user_code="WDJB-MJHT",
        verification_uri="https://github.com/login/device",
        expires_in=900,
        interval=5,
    )
    with patch("routers.auth.start_device_flow", return_value=payload):
        client.post("/auth/github/device/start")

    with patch("routers.auth.check_token_once", return_value=PollResult(state="pending")):
        response = client.get("/auth/github/status")
    assert response.json() == {"state": "pending", "login": None}

    with patch("routers.auth.check_token_once", return_value=PollResult(state="authorized", login="octocat")):
        response = client.get("/auth/github/status")
    assert response.json() == {"state": "authorized", "login": "octocat"}


def test_status_falls_back_to_authorized_when_a_token_already_exists():
    import config_store

    config_store.save({"github_token": "ghp_existing"})

    response = client.get("/auth/github/status")

    assert response.status_code == 200
    assert response.json()["state"] == "authorized"


def test_delete_clears_the_stored_token():
    import config_store

    config_store.save({"github_token": "ghp_existing"})

    response = client.delete("/auth/github")

    assert response.status_code == 200
    assert config_store.load()["github_token"] is None
