"""FastAPI app entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from chroma_client import get_chroma_client
from routers.ingest import router as ingest_router
from routers.query import router as query_router
from routers.repos import router as repos_router
from routers.retrieve import router as retrieve_router

app = FastAPI(title="adr-engine")

# Single-user, no-auth, local-only tool per SYSTEM-DESIGN.md — the frontend
# and backend run on different localhost ports, which are different origins
# to a browser. No credentials are ever sent, so a permissive origin policy
# doesn't expose anything a same-origin policy would otherwise protect.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(retrieve_router)
app.include_router(query_router)
app.include_router(repos_router)


@app.get("/health")
def health() -> dict:
    try:
        get_chroma_client().heartbeat()
        chroma_status = "ok"
    except Exception:
        chroma_status = "unreachable"

    return {"status": "ok", "chroma": chroma_status}
