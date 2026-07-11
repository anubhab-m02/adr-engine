import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_returns_ok_status():
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["chroma"] in {"ok", "unreachable"}


def test_health_reports_chroma_connectivity(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_DATA_DIR", str(tmp_path))

    import chroma_client

    chroma_client.get_chroma_client.cache_clear()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["chroma"] == "ok"
