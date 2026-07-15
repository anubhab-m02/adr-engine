"""FastAPI app entrypoint."""

from fastapi import FastAPI

from chroma_client import get_chroma_client
from routers.ingest import router as ingest_router
from routers.retrieve import router as retrieve_router

app = FastAPI(title="adr-engine")
app.include_router(ingest_router)
app.include_router(retrieve_router)


@app.get("/health")
def health() -> dict:
    try:
        get_chroma_client().heartbeat()
        chroma_status = "ok"
    except Exception:
        chroma_status = "unreachable"

    return {"status": "ok", "chroma": chroma_status}
