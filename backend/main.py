"""FastAPI app entrypoint for the adr-engine backend."""

from dotenv import load_dotenv
from fastapi import FastAPI

from chroma_client import get_chroma_client

load_dotenv()

app = FastAPI(title="adr-engine")


@app.get("/health")
def health() -> dict:
    """Report app liveness and Chroma connectivity."""
    try:
        get_chroma_client().heartbeat()
        chroma_status = "ok"
    except Exception:
        chroma_status = "unreachable"

    return {
        "status": "ok",
        "chroma": chroma_status,
    }
