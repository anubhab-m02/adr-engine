# Architecture — adr-engine

Code-level structure and conventions. The unattended daily agent treats
this file as binding; deviations belong in a PR discussion, not silent
drift. See [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md) for the why behind these
shapes.

## Repository layout

```
backend/
  main.py               # FastAPI app assembly + /health only
  config.py             # pydantic-settings Settings; ALL env reads live here
  chroma_client.py      # PersistentClient factory (cached)
  models.py             # DecisionUnit + API request/response models (pydantic)
  ingestion/
    github_client.py    # GitHub REST → typed models; pagination; rate-limit aware
    extract.py          # commit/PR text → DecisionUnit | NotADecision (Ollama)
    embed.py            # text → vector (Ollama nomic-embed-text)
    store.py            # DecisionUnit upsert/query against Chroma; cursor I/O
    run.py              # orchestrator: fetch → extract → embed → store
  retrieval/
    search.py           # query embedding + top-k + relevance floor
  synthesis/
    answer.py           # retrieved units → Gemini prompt → parsed answer+citations
  routers/
    ingest.py           # POST /ingest  (thin: parse, call ingestion.run, shape response)
    retrieve.py         # POST /retrieve (thin: parse, call retrieval.search)
    query.py            # POST /query   (thin: retrieval + synthesis)
  tests/
    fixtures/           # canned GitHub API payloads, canned Ollama/Gemini outputs
    ...
frontend/
  src/
    api.js              # single fetch wrapper for all backend calls
    components/         # presentational components (see UI-DESIGN.md)
    App.jsx
docs/                   # this file + SYSTEM-DESIGN.md + UI-DESIGN.md + eval-questions.md
```

## Dependency rules

- `routers/*` are thin: parse request → call one service function →
  shape response. No business logic in routers.
- `ingestion/`, `retrieval/`, `synthesis/` may import `models`, `config`,
  `chroma_client` — never `routers` and never each other, with one
  exception: `synthesis` may call `retrieval`.
- `github_client` returns typed models only; GitHub's raw JSON schema
  must not leak past that module.
- All environment access goes through `config.Settings`. No `os.getenv`
  scattered in modules.
- LLM calls are isolated in exactly three places: `extract.py` (local),
  `embed.py` (local), `answer.py` (cloud). Nothing else talks to a model.

## Testing conventions (binding for the daily agent)

- **No test may require network, Ollama, Chroma-with-real-embeddings, or
  Gemini.** CI has none of these. Model calls are faked with fixture
  files under `tests/fixtures/`; the GitHub client is tested against
  canned response payloads.
- Every module that parses model output (extract, answer) must have
  fixture tests for: well-formed output, malformed JSON, and the
  "not a decision" / "not found" paths.
- Chroma-touching tests use a real Chroma client against `tmp_path`
  (it's embedded and file-based — no service needed) with pre-computed
  fake vectors, not real embeddings.
- `pytest` from `backend/` must pass in a clean environment. This is the
  daily agent's self-verification gate before opening/updating its PR.

## Error-handling conventions

- Custom exceptions per boundary: `GitHubError`, `ExtractionError`,
  `EmbeddingError`, `SynthesisError` — raised at the boundary module,
  translated to HTTP status codes only in routers.
- Ingestion is per-item fault-tolerant (skip + count), per-run
  fail-loud (Ollama down, rate-limited → abort with clear message).
- Never catch bare `Exception` to keep a run alive.

## Frontend conventions

- Plain React + Tailwind, JavaScript (no TypeScript — matches BuFin).
- All backend calls go through `src/api.js`; components never `fetch`.
- Components are presentational; state lives in `App.jsx` (single page,
  no router, no global state library in Phase 1).
