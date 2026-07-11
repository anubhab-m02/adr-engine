"""FastAPI app entrypoint."""

from fastapi import FastAPI

from chroma_client import get_chroma_client

app = FastAPI(title="adr-engine")


@app.get("/health")
def health() -> dict:
    try:
        get_chroma_client().heartbeat()
        chroma_status = "ok"
    except Exception:
        chroma_status = "unreachable"

    return {"status": "ok", "chroma": chroma_status}
