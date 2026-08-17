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
  config_store.py       # Phase 2: local JSON config store; env overrides win
  chroma_client.py      # PersistentClient factory (cached)
  models.py             # DecisionUnit + API request/response models (pydantic)
  auth/
    device_flow.py      # Phase 2: GitHub OAuth device flow (start/poll/persist)
  jobs/
    ingest_job.py       # Phase 2: background ingestion task + in-process job state
  ingestion/
    github_client.py    # GitHub REST → typed models; pagination; rate-limit aware
    local_git.py         # Track A: local clone → typed models via the `git` CLI, no API/token
    diff_filter.py        # Track A: excludes lockfile/generated/vendored hunks, caps diff size
    extract.py          # commit/PR text + filtered diff → DecisionUnit | NotADecision (Ollama)
    embed.py            # text → vector (Ollama nomic-embed-text)
    store.py            # DecisionUnit upsert/query against Chroma; cursor I/O
    run.py              # orchestrator: fetch → extract → embed → store
  retrieval/
    search.py           # query embedding + top-k + relevance floor
  synthesis/
    answer.py           # retrieved units → Gemini prompt → parsed answer+citations
  eval/                  # Track A: recall@5 quality gate
    harness.py             # frozen fixture → recall@5, floor/broken/ratchet exit codes
    docs_eval_questions.py # parses golden questions straight out of docs/eval-questions.md
    build_fixture.py       # one-off: real ingestion → fixtures/ (not run in CI)
    fixtures/               # checked-in frozen DecisionUnits + embeddings
  routers/              # ALL thin: parse, call one service, shape response
    ingest.py           # POST /ingest (202) + GET /ingest/status
    retrieve.py         # POST /retrieve
    query.py            # POST /query
    repos.py             # Phase 2: GET/DELETE/PATCH /repos
    auth.py             # Phase 2: /auth/github/* device flow
    config.py           # Phase 2: GET/PATCH /config
    setup.py            # Phase 2: GET /setup/state
  tests/
    fixtures/           # canned GitHub API payloads, canned Ollama/Gemini outputs
    ...
frontend/
  src/
    api.js              # single fetch wrapper for all backend calls
    shell/              # AppShell, TopNav, StatusPill (Phase 2)
    onboarding/         # device-flow connect, repo picker, index step (Phase 2)
    ask/                # the reading room: AnswerPassage, SourceCard, SourcesView…
    library/            # repo rows, IndexProgress (Phase 2)
    settings/           # per-section settings components (Phase 2)
    lib/
      useIngestStatus.js  # THE single ingest-status poll hook (context-shared)
    components/         # remaining shared presentational pieces
    App.jsx             # router + shell + setup gate only (Phase 2)
docs/                   # this file + SYSTEM-DESIGN.md + UI-DESIGN.md + eval-questions.md
```

## Dependency rules

- `routers/*` are thin: parse request → call one service function →
  shape response. No business logic in routers.
- `ingestion/`, `retrieval/`, `synthesis/`, `auth/`, `jobs/` may import
  `models`, `config`, `config_store`, `chroma_client` — never `routers`
  and never each other, with two exceptions: `synthesis` may call
  `retrieval`, and `jobs` may call `ingestion` (it orchestrates it).
- `github_client` returns typed models only; GitHub's raw JSON schema
  must not leak past that module. Same rule for `auth/device_flow`.
- All configuration reads go through `config.Settings`, which resolves
  env overrides on top of `config_store` (Phase 2). No `os.getenv` and
  no direct store reads scattered in modules. Secrets are masked in
  every API response.
- Exception: `config_store.py` and `chroma_client.py` read
  `CHROMA_DATA_DIR` via `os.getenv` directly, not through
  `config.Settings` — `Settings` itself reads `config_store`, so routing
  the store's own bootstrap path through `Settings` would be circular.
  This is the only sanctioned `os.getenv` outside `config.py`.
- LLM calls are isolated in exactly three places: `extract.py` (local),
  `embed.py` (local), `answer.py` (cloud). Nothing else talks to a model.

## Diff filtering for extraction

`backend/ingestion/diff_filter.py` runs on every unified diff before it
reaches `extract.py`, so the local extraction model never sees lockfile
churn or multi-thousand-line diffs:

- Whole-file hunks are dropped for paths matching: `package-lock.json`,
  `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, `go.sum`,
  `*.min.js`, `*.min.css`, `dist/*`, `build/*`, `node_modules/*`,
  `vendor/*` — each pattern also matches nested under any subdirectory
  (e.g. a lockfile inside a `frontend/` subpackage).
- What's left is capped at 400 lines total: the first 300 kept, the last
  100 kept, the middle dropped with the omitted line count stated inline
  (`... [N lines omitted] ...`).
- That 400/300/100 split was sized off BuFin's own measured diff
  distribution over its last 100 commits (median 45 lines, p90 361, max
  3,140) — large enough to keep the typical diff whole, small enough to
  cap the rare outlier.

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

## Eval fixture regeneration (binding)

`backend/eval/fixtures/decision_units.json` and `embeddings.json` are a
frozen snapshot of real ingestion output, tied to whichever embedding
model produced the vectors inside it. Whenever `OLLAMA_EMBEDDING_MODEL`
changes, the fixture MUST be regenerated via `python -m
eval.build_fixture` before merging. A PR that changes
`OLLAMA_EMBEDDING_MODEL` without regenerating the fixture is breaking the
eval harness even if `eval/harness.py` still exits 0 in CI — recall@5
computed against embeddings from a different model than the one currently
configured measures nothing meaningful, it just happens to produce a
number.

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
- Routing via `react-router-dom` (Phase 2 supersedes Phase 1's "no
  router" rule): `/` Ask, `/library`, `/settings`, `/onboarding`, with
  the setup gate in `App.jsx`. Still no global state library — page
  state lives in each page component; the one cross-page piece of state
  (ingest status) lives in the `useIngestStatus` context hook, and
  there is never more than one active status poller.
- Components are presentational; fonts are bundled via `@fontsource`
  (no CDN — local-first). Visual system, tokens, and per-surface specs:
  [UI-DESIGN.md](UI-DESIGN.md) (binding).
