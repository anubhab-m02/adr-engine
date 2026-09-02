"""POST /config/validate-gemini and /config/validate-ollama: live pings.

Only ever hit on the frontend's explicit "save" action, never on GET
/config or automatically, per docs/superpowers/specs/2026-08-04-v2-design.md
decision 9.
"""

from fastapi import APIRouter

from ingestion.ollama_client import check_ollama
from models import ValidationResponse
from synthesis.answer import validate_gemini

router = APIRouter()


@router.post("/config/validate-gemini", response_model=ValidationResponse)
def validate_gemini_endpoint() -> ValidationResponse:
    ok, detail = validate_gemini()
    return ValidationResponse(ok=ok, detail=detail)


@router.post("/config/validate-ollama", response_model=ValidationResponse)
def validate_ollama_endpoint() -> ValidationResponse:
    ok, detail = check_ollama()
    return ValidationResponse(ok=ok, detail=detail)
