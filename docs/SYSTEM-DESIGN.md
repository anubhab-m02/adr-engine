# System Design — adr-engine

## Requirements

**Functional**
- Ingest commits and PRs (title, body, review comments) from a configured
  list of GitHub repos, incrementally.
- Extract a structured "decision unit" from each commit/PR: what was
  decided, why, alternatives considered.
- Answer natural-language questions ("why is auth done this way?") with
  answers cited back to specific commits/PRs.
- React chat UI with clickable citation cards.

**Non-functional**
- Single user, self-hosted. No user accounts ever (see PRODUCT.md's
  form factor); GitHub access is authorized via OAuth device flow in
  Phase 2, with the token stored locally.
- Phase 2 onboarding bar: launch → first cited answer in minutes,
  without editing a config file.
- Privacy: indexed content (commit bodies, diffs, PR text) never leaves
  the machine at index time. Only retrieved top-k snippets go to a cloud
  model, and only at query time.
- Cost: ~zero at idle. No cloud calls during ingestion. Cloud calls only
  per user question.
- Batch freshness is fine: ingestion runs on demand or on a schedule;
  no real-time requirements.
- All automated tests must run in GitHub Actions with **no network and no
  Ollama** (the delivery agent runs in CI) — live-model behavior is
  verified manually, not in tests.

**Constraints**
- Solo developer; work lands via an unattended daily agent in small PRs.
- Stack fixed by prior decisions: FastAPI + Chroma + Ollama local models
  (`nomic-embed-text` embeddings, `phi4-mini`-class extraction) + Gemini
  for synthesis + React (Vite).

## High-level design

```
                        ┌────────────────────────────────────────────┐
                        │                  backend                   │
  GitHub API ──fetch──▶ │ ingestion/                                 │
                        │   github_client ─▶ extract ─▶ embed ─▶ store │──▶ Chroma
                        │   (typed models)  (Ollama)   (Ollama)      │   (local disk)
                        │                                            │
  React UI ──POST /query─▶ routers/query ─▶ retrieval ─▶ synthesis ──│──▶ Gemini
       ▲                │                    (Chroma      (top-k     │   (cloud)
       └── answer + citations ◀──────────────  top-k)      only)     │
                        └────────────────────────────────────────────┘
```

Two independent pipelines sharing the Chroma store:

1. **Ingestion (write path, local-only):** GitHub → typed models →
   extraction (local LLM) → embedding (local) → Chroma upsert.
2. **Query (read path, hybrid):** question → embed locally → Chroma
   top-k → synthesis prompt to Gemini with only the retrieved units →
   cited answer.

## Data model

The core entity is the **DecisionUnit** — one extracted decision from one
commit or PR:

```
DecisionUnit
  id: str              # stable: "{repo}:{kind}:{ref}" e.g. "anubhab-m02/BuFin:pr:42"
  repo: str            # "owner/name"
  kind: "commit"|"pr"
  ref: str             # commit SHA or PR number (as string)
  url: str             # deep link to GitHub
  author: str
  date: str            # ISO 8601
  title: str           # commit headline / PR title
  decision: str        # what was decided
  rationale: str       # why (may be empty if not inferable)
  alternatives: list[str]   # alternatives mentioned, often empty
  source_excerpt: str  # trimmed original text the extraction saw
```

**Chroma layout:** one collection `decisions`. Document text =
`"{title}\n{decision}\n{rationale}"` (what gets embedded). Everything
else is metadata. The `id` field is the Chroma ID → upserts are naturally
idempotent; re-ingesting the same commit overwrites rather than
duplicates.

**Cursor store:** `{CHROMA_DATA_DIR}/cursors.json`, keyed by repo:
`{"owner/name": {"last_commit_date": ..., "last_pr_updated_at": ...}}`.
Read at the start of an ingestion run, written only after a successful
run. Losing it is safe (re-ingestion is idempotent), it only costs time.

## API contracts

| Endpoint | In | Out |
|---|---|---|
| `GET /health` | — | `{status, chroma: "ok"\|"unreachable"}` |
| `GET /setup/state` | — | `{github_connected, repos_selected, first_index_done, gemini_key_set}` — drives the onboarding gate |
| `POST /auth/github/device/start` | — | `{user_code, verification_uri, expires_in, interval}` |
| `GET /auth/github/status` | — | `{state: "pending"\|"authorized"\|"expired"\|"denied", login?}` |
| `DELETE /auth/github` | — | disconnects; token removed from the config store |
| `GET /github/repos` | `?query=` | repos visible to the token (name, private, commit-count estimate) — for the picker |
| `GET /config` | — | current config, secrets masked (`ghp_…4f2a`) |
| `PATCH /config` | partial config (gemini key, models, indexed repos…) | updated masked config; key/model changes validated live |
| `GET /repos` | — | `{repos: [{repo: str, indexed_units: int}]}` — indexed counts, for the UI filter |
| `POST /ingest` | `{repos?: [str]}` (default: all configured) | **202** `{job_id}` — ingestion runs as a background task (Phase 2; was synchronous in Phase 1) |
| `GET /ingest/status` | — | `{active: bool, repos: [{repo, phase: "queued"\|"fetching"\|"extracting"\|"embedding"\|"done"\|"failed", counts: {fetched, extracted, skipped, stored}, error?}]}` |
| `POST /retrieve` | `{query: str, k?: int=5, repos?: [str]}` | `{results: [{unit: DecisionUnit, score: float}]}` |
| `POST /query` | `{question: str, repos?: [str]}` | `{answer: str\|null, citations: [DecisionUnit], retrieved_count: int, mode: "synthesized"\|"sources_only"}` |

`repos` filters retrieval to the named repos via a Chroma metadata filter;
omitted or empty means all indexed repos.

`/query` calls the same retrieval logic as `/retrieve`, then synthesizes.
If nothing clears the relevance threshold, it returns an explicit
"no relevant decisions found" answer with empty citations — it must never
fabricate. When no Gemini key is configured, it skips synthesis and
returns `mode: "sources_only"` with `answer: null` — the UI renders the
retrieved units directly (degraded mode is a product state, not an
error).

## Configuration, auth, and jobs (Phase 2)

**Config store.** A local JSON file at `{CHROMA_DATA_DIR}/config.json`
becomes the source of truth for GitHub token, Gemini key, indexed repos,
and model settings, managed via `GET/PATCH /config`. Environment
variables remain as dev-time overrides (env wins when set), so existing
`.env` setups keep working. Secrets are masked in every API response and
never leave the machine.

**GitHub auth.** OAuth device flow: the backend proxies GitHub's device
endpoints (client ID ships in code; device flow needs no secret), polls
for the grant at GitHub's stated interval, and persists the resulting
token in the config store. No user accounts — this is authorization,
not identity.

**Ingestion jobs.** One in-process background task (FastAPI
`BackgroundTasks`-level machinery; no queue infrastructure for a
single-user app) with a module-level job state the status endpoint
reads. Per-repo phase transitions and counts update as the pipeline
runs; failure captures the boundary error message per repo without
killing the other repos' progress. The cursor rules from Phase 1 are
unchanged: written only after a repo completes successfully.

## Deep-dive decisions

**Extraction is local-only, no cloud fallback.** BuFin's pattern
(Ollama-first, Gemini fallback) is wrong here: a silent fallback at
index time would leak full commit/PR content to the cloud, violating the
core privacy property. If Ollama is unreachable, ingestion fails loudly.
An `ALLOW_CLOUD_EXTRACTION=true` escape hatch may be added later, default
off, but is out of scope for Phase 1.

**"Not a decision" filtering happens at extraction.** The extraction
prompt classifies trivial changes (typo fixes, formatting, dep bumps
without discussion) as no-decision; those are skipped, not stored. This
keeps the index high-signal. The skip signal is part of the extraction
module's contract and is tested with fixtures.

**Malformed model output policy:** one retry with a "return only JSON"
reinforcement, then skip the item and log a warning. An ingestion run
never crashes on one bad item; the run summary reports skip counts.

**Rate limits:** the GitHub client respects `x-ratelimit-remaining` and
sleeps-or-aborts cleanly with a clear error rather than hammering.
Single-user scale makes this rare; correctness over throughput.

**Relevance threshold:** retrieval drops results below a similarity
floor rather than always returning k. The floor is a config value tuned
manually during Phase 1 evaluation (see below), not hardcoded magic.

**Synthesis prompt contract:** Gemini receives the retrieved units as
structured context plus instructions to (a) answer only from the
provided units, (b) cite by unit `id` inline, (c) say "not found in the
indexed history" when the units don't cover the question. The response
is parsed into `answer` + resolved `citations` server-side, so the
frontend never parses prose.

## Evaluation (lightweight, Phase 1)

A `docs/eval-questions.md` file accumulates ~10 golden questions about
the indexed repos with expected source commits/PRs. After retrieval or
extraction changes, run them manually and eyeball citations. No automated
eval harness in Phase 1 — but the golden file keeps quality regressions
visible.

## Failure modes and handling

| Failure | Behavior |
|---|---|
| Ollama down during ingestion | Run aborts with a clear error; nothing partial is written past the last successful item (upserts are per-item, cursor written only on success) |
| Ollama down during query | Query embedding fails → 503 with a clear message; UI shows error state |
| Gemini down/unauthorized | 502 from `/query` with the upstream message; retrieval still works via `/retrieve` |
| GitHub rate-limited | Ingestion aborts cleanly, reports where it stopped; cursor unchanged so next run resumes |
| Malformed extraction JSON | Retry once, then skip + log; run summary counts skips |

## Trade-offs made explicit

- **Chroma over pgvector/Qdrant:** zero infra, file-based, fine for
  ≤100k units. Revisit if multi-repo indexing grows past that.
- **In-process background ingestion over a real job queue:** Phase 2
  moves `/ingest` off the blocking call (the Phase 1 trade-off, now
  paid down) but deliberately stops at one background task + polled
  status — Celery/RQ-grade infrastructure buys nothing for a
  single-user local app.
- **Local extraction quality < cloud quality:** accepted for privacy.
  Mitigated by the golden-questions eval and by keeping `source_excerpt`
  so weak extractions can be re-run later with a better local model.
- **No streaming responses in Phase 1:** answers are short; complexity
  not justified yet.

## What we'd revisit as it grows

- Hybrid keyword+vector retrieval (BM25 + embeddings) if pure vector
  retrieval misses exact identifiers ("Redis", "JWT").
- File-path metadata on DecisionUnits (Phase 3's decision browser)
  enabling path-scoped retrieval.
- Jira and Slack sources — parked until GitHub is fully proven (see
  ROADMAP.md); same DecisionUnit model, new `kind` values.
- Multi-user/accounts if this ever becomes a team tool (explicitly not
  planned).
