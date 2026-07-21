"""GitHub OAuth device flow: start + poll against GitHub's device endpoints.

The client ID ships in code — device flow needs no client secret, per
SYSTEM-DESIGN.md's GitHub auth section, so this is not a secret and is
safe to hardcode. GitHub's raw JSON must not leak past this module, per
ARCHITECTURE.md.
"""

import time

import httpx
from pydantic import BaseModel

import config_store

GITHUB_OAUTH_CLIENT_ID = "Ov23li76dVynkk5L7OsK"
GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_DEVICE_FLOW_SCOPE = "repo"
GITHUB_USER_URL = "https://api.github.com/user"

REQUEST_TIMEOUT_SECONDS = 10


class GitHubAuthError(Exception):
    """Raised on boundary failures talking to GitHub's device-flow endpoints."""


class DeviceCodeResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    expires_in: int
    interval: int


class PollResult(BaseModel):
    state: str  # "authorized" | "expired" | "denied"
    login: str | None = None


def start_device_flow() -> DeviceCodeResponse:
    try:
        response = httpx.post(
            GITHUB_DEVICE_CODE_URL,
            data={"client_id": GITHUB_OAUTH_CLIENT_ID, "scope": GITHUB_DEVICE_FLOW_SCOPE},
            headers={"Accept": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException as exc:
        raise GitHubAuthError(f"request to GitHub timed out: {exc}") from exc

    if response.is_error:
        raise GitHubAuthError(f"GitHub device code request failed: {response.status_code} {response.text}")

    data = response.json()
    if "error" in data:
        raise GitHubAuthError(f"GitHub device code request failed: {data.get('error_description', data['error'])}")

    return DeviceCodeResponse(
        device_code=data["device_code"],
        user_code=data["user_code"],
        verification_uri=data["verification_uri"],
        expires_in=data["expires_in"],
        interval=data["interval"],
    )


def _fetch_token(device_code: str) -> dict:
    try:
        response = httpx.post(
            GITHUB_ACCESS_TOKEN_URL,
            data={
                "client_id": GITHUB_OAUTH_CLIENT_ID,
                "device_code": device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            },
            headers={"Accept": "application/json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException as exc:
        raise GitHubAuthError(f"request to GitHub timed out: {exc}") from exc

    if response.is_error:
        raise GitHubAuthError(f"GitHub access token request failed: {response.status_code} {response.text}")

    return response.json()


def _fetch_login(token: str) -> str | None:
    try:
        response = httpx.get(
            GITHUB_USER_URL,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException:
        return None

    if response.is_error:
        return None

    return response.json().get("login")


def poll_for_token(device_code: str, interval: int) -> PollResult:
    """Poll GitHub's access-token endpoint, sleeping `interval` seconds
    (GitHub's stated cadence, possibly extended via `slow_down`) between
    attempts, until a definitive state is reached. On `authorized`,
    persists the token to the config store before returning."""
    while True:
        data = _fetch_token(device_code)

        if "access_token" in data:
            token = data["access_token"]
            config_store.save({"github_token": token})
            return PollResult(state="authorized", login=_fetch_login(token))

        error = data.get("error")
        if error == "authorization_pending":
            time.sleep(interval)
            continue
        if error == "slow_down":
            interval = data.get("interval", interval + 5)
            time.sleep(interval)
            continue
        if error == "expired_token":
            return PollResult(state="expired")
        if error == "access_denied":
            return PollResult(state="denied")

        raise GitHubAuthError(f"unexpected GitHub device flow response: {data}")
