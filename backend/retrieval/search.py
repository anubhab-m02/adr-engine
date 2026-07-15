"""Query embedding + top-k retrieval + relevance floor, per SYSTEM-DESIGN.md.

RELEVANCE_FLOOR is a starting value; tune manually via docs/eval-questions.md
as retrieval quality against the golden questions is evaluated.
"""

from ingestion import embed, store
from models import RetrieveResult

RELEVANCE_FLOOR = 0.3


def search(query: str, k: int = 5, repos: list[str] | None = None) -> list[RetrieveResult]:
    vector = embed.embed_text(query)
    results = store.query_units(vector, k, repos)

    return [
        RetrieveResult(unit=unit, score=score)
        for unit, score in results
        if score >= RELEVANCE_FLOOR
    ]
