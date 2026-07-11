import pytest
from fastapi.testclient import TestClient

import chroma_client
import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path / "chroma_data"))
    chroma_client.get_chroma_client.cache_clear()
    return TestClient(main.app)


def test_health_reports_ok_status_and_chroma_connectivity(client):
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["chroma"] == "ok"


def test_health_persists_chroma_to_configured_directory(client, tmp_path):
    client.get("/health")

    assert (tmp_path / "chroma_data").exists()
