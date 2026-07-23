import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
import pytest

import config_store
from auth.device_flow import (
    DeviceCodeResponse,
    GitHubAuthError,
    PollResult,
    check_token_once,
    poll_for_token,
    start_device_flow,
)


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))


def test_start_device_flow_returns_typed_response():
    payload = {
        "device_code": "devcode123",
        "user_code": "WDJB-MJHT",
        "verification_uri": "https://github.com/login/device",
        "expires_in": 900,
        "interval": 5,
    }

    with patch("auth.device_flow.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json=payload)

        result = start_device_flow()

    assert result == DeviceCodeResponse(**payload)


def test_start_device_flow_raises_on_error_body():
    with patch("auth.device_flow.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(
            200, json={"error": "unauthorized_client", "error_description": "bad client id"}
        )

        with pytest.raises(GitHubAuthError):
            start_device_flow()


def test_start_device_flow_raises_on_non_2xx():
    with patch("auth.device_flow.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(500, text="server error")

        with pytest.raises(GitHubAuthError):
            start_device_flow()


def test_poll_for_token_success_persists_token_and_returns_login():
    def fake_post(url, data=None, headers=None, timeout=None):
        if url.endswith("/oauth/access_token"):
            return httpx.Response(200, json={"access_token": "ghp_newtoken", "token_type": "bearer"})
        raise AssertionError(f"unexpected POST {url}")

    with patch("auth.device_flow.httpx.post", side_effect=fake_post), patch(
        "auth.device_flow.httpx.get"
    ) as mock_get:
        mock_get.return_value = httpx.Response(200, json={"login": "octocat"})

        result = poll_for_token("devcode123", interval=0)

    assert result == PollResult(state="authorized", login="octocat")
    assert config_store.load()["github_token"] == "ghp_newtoken"


def test_poll_for_token_retries_on_authorization_pending_then_succeeds():
    responses = iter(
        [
            httpx.Response(200, json={"error": "authorization_pending"}),
            httpx.Response(200, json={"access_token": "ghp_newtoken"}),
        ]
    )

    with patch("auth.device_flow.httpx.post", side_effect=lambda *a, **k: next(responses)), patch(
        "auth.device_flow.httpx.get"
    ) as mock_get, patch("auth.device_flow.time.sleep") as mock_sleep:
        mock_get.return_value = httpx.Response(200, json={"login": "octocat"})

        result = poll_for_token("devcode123", interval=5)

    assert result.state == "authorized"
    mock_sleep.assert_called_once_with(5)


def test_poll_for_token_returns_expired_state_without_raising():
    with patch("auth.device_flow.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json={"error": "expired_token"})

        result = poll_for_token("devcode123", interval=0)

    assert result == PollResult(state="expired")
    assert config_store.load()["github_token"] is None


def test_poll_for_token_returns_denied_state_without_raising():
    with patch("auth.device_flow.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json={"error": "access_denied"})

        result = poll_for_token("devcode123", interval=0)

    assert result == PollResult(state="denied")
    assert config_store.load()["github_token"] is None


def test_poll_for_token_raises_on_unexpected_error():
    with patch("auth.device_flow.httpx.post") as mock_post:
        mock_post.return_value = httpx.Response(200, json={"error": "incorrect_client_credentials"})

        with pytest.raises(GitHubAuthError):
            poll_for_token("devcode123", interval=0)


def test_check_token_once_returns_pending_without_sleeping():
    with patch("auth.device_flow.httpx.post") as mock_post, patch(
        "auth.device_flow.time.sleep"
    ) as mock_sleep:
        mock_post.return_value = httpx.Response(200, json={"error": "authorization_pending"})

        result = check_token_once("devcode123")

    assert result == PollResult(state="pending")
    mock_sleep.assert_not_called()


def test_check_token_once_returns_authorized_and_persists_token():
    with patch("auth.device_flow.httpx.post") as mock_post, patch(
        "auth.device_flow.httpx.get"
    ) as mock_get:
        mock_post.return_value = httpx.Response(200, json={"access_token": "ghp_newtoken"})
        mock_get.return_value = httpx.Response(200, json={"login": "octocat"})

        result = check_token_once("devcode123")

    assert result == PollResult(state="authorized", login="octocat")
    assert config_store.load()["github_token"] == "ghp_newtoken"
