# Roadmap — adr-engine

> "Context drives intent, which manifests as code. If over time, code is
> the only remaining archaeological artefact, we are simply left with
> effect without knowing the cause."

RAG applied to a team's *living decision history*, not static documents.
Ask "why is auth done this way?" and get a cited answer pointing back to
the commit or PR where that decision actually happened.

Design docs: [SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) ·
[ARCHITECTURE.md](docs/ARCHITECTURE.md) · [UI-DESIGN.md](docs/UI-DESIGN.md)

## Delivery model (how work lands here)

Work is delivered by an unattended daily agent picking issues off the
backlog. The model is designed so the agent can make progress for days
without a human merging anything:

- **Rolling branch:** the agent works on a single long-lived branch
  (`agent/rolling`), created from `main` when absent. Day N+1 builds on
  day N's unmerged work because it's the same branch. One PR from
  `agent/rolling` → `main` accumulates the work; its body maintains a
  checklist of `Closes #N` lines per completed issue.
- **Issue state machine:** `daily-task` (eligible) → agent completes it
  and adds the `in-pr` label (now invisible to the picker) → merging the
  rolling PR auto-closes it. `needs-input` marks issues blocked on a
  human; `needs-triage` marks agent-proposed issues awaiting promotion.
- **Issue sizing rules (binding):**
  - One module or one component per issue; target diff ≤ ~150 lines
    excluding fixtures.
  - Every issue names exact files to create/modify and acceptance
    criteria checkable by `pytest`/`npm test` in CI (no network, no
    Ollama — see ARCHITECTURE.md testing conventions).
  - Issues are numbered in dependency order; the picker takes the
    lowest-numbered eligible issue, so an issue may assume all
    lower-numbered issues exist on the rolling branch (merged or not).
- **Per run:** the agent completes 1–3 issues (as budget allows),
  committing each in 1–3 natural commits, then updates the single
  rolling PR. Daily output therefore varies naturally between ~1 and ~9
  commits.
- **Human loop:** review the rolling PR whenever available; merging it
  closes the completed issues and resets the cycle. Groom `needs-triage`
  into `daily-task` (or close) during ideation sessions.

## Phase 1 — MVP: GitHub only (current)

Goal: ask a question about the indexed repos in the React UI and get a
correctly cited answer, end to end, locally.

Batches (each batch = several one-PR-sized issues, in dependency order):

- **A. Foundation** — config module, typed models, Chroma store layer,
  test fixtures scaffolding. *(Backend scaffold + health check already
  landed via PR #12.)*
- **B. GitHub ingestion** — client (commits, then PRs, then pagination/
  rate-limit handling as separate issues), cursor persistence.
- **C. Extraction & embedding** — extraction prompt + JSON parsing +
  skip signal, malformed-output handling, embedding wrapper, ingestion
  orchestrator, `/ingest` endpoint.
- **D. Retrieval & synthesis** — search with relevance floor + repo
  filter, `/retrieve`, `GET /repos`, synthesis prompt + citation
  parsing, `/query`, golden-questions eval file.
- **E. Frontend** — Vite+Tailwind scaffold, tokens, then one component
  per issue (ChatInput, CitationCard, AnswerCard, MessageList,
  Loading/Error cards, RepoFilter), api.js, wiring, empty state.
- **F. Polish & docs** — README quickstart, .env reconciliation,
  ingestion CLI entry point.

## Phase 2 — Jira
Ticket descriptions + comments as a new DecisionUnit `kind`, linked to
commits/PRs via branch/PR references. Scoped when Phase 1 ships.

## Phase 3 — Slack (opt-in per channel)
Privacy-sensitive; needs its own scoping pass.

## Evaluation

No automated eval harness in Phase 1 (see SYSTEM-DESIGN.md). Quality is
checked manually against [docs/eval-questions.md](docs/eval-questions.md),
a running list of golden questions with their expected cited source —
run each through `/query` after a retrieval or extraction change and
watch for drift.

## Non-goals (for now)
Hosted/multi-user deployment, auth, real-time ingestion, fine-tuning,
TypeScript migration.
