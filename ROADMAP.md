# Roadmap — adr-engine

> "Context drives intent, which manifests as code. If over time, code is
> the only remaining archaeological artefact, we are simply left with
> effect without knowing the cause."

RAG applied to a team's *living decision history*, not static documents.
Ask "why is auth done this way?" and get a cited answer pointing back to
the commit or PR where that decision actually happened.

Design docs: [PRODUCT.md](PRODUCT.md) ·
[SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) ·
[ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[UI-DESIGN.md](docs/UI-DESIGN.md)

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

## Phase 1 — MVP: GitHub only (complete, pending final polish)

Goal reached: ask a question about the indexed repos in the React UI and
get a correctly cited answer, end to end, locally. All batches (A–F)
delivered; remaining loose ends: #39 (.env reconciliation), #40
(ingestion CLI entry point) — both fold naturally into Phase 2's config
work.

## Phase 2 — Productization (current)

A stranger can run adr-engine without touching a config file. Form
factor locked by [PRODUCT.md](PRODUCT.md): **local-first product** — no
user accounts, no hosting; "login" is GitHub authorization via OAuth
device flow. Full UX/visual spec: [docs/UI-DESIGN.md](docs/UI-DESIGN.md)
(binding); API contracts: [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md).

Success: launch → first cited answer in minutes, zero file editing; the
UI stops looking like a stock chat template (editorial/archival
identity, WCAG 2.1 AA).

Batches (dependency order, each = several one-PR-sized issues):

- **G. Config store & GitHub auth (backend)** — UI-managed local config
  store (`.env` demoted to dev override), `GET/PATCH /config`, GitHub
  device-flow endpoints, `GET /setup/state`, `GET /github/repos`.
  Absorbs #39/#40.
- **H. Background ingestion** — `POST /ingest` → 202 + job state,
  `GET /ingest/status` with per-repo phase and live counts; frontend
  `useIngestStatus` hook + StatusPill in the shell.
- **I. App shell & onboarding (frontend)** — react-router, shell with
  top nav, onboarding flow: Connect (device code) → Choose repos →
  Indexing, optional Gemini key step; setup gate.
- **J. The reading room** — editorial identity: new tokens/fonts,
  AnswerPassage + inline citation markers + SourceCards, degraded
  sources-only mode (`/query` `mode` field, backend), signature motion.
- **K. Library & Settings** — repo rows with live status, re-index /
  remove, add-repos; settings sections (GitHub, Gemini, models, data).
- **L. Hardening pass** — responsive/mobile fixes, a11y verification
  (contrast, keyboard, reduced motion), state-coverage sweep.

## Phase 3 — The living archive

What makes the product returned-to, not just usable:

- **Question history + follow-ups** — persisted threads; follow-up
  questions carry prior citations into retrieval.
- **Decision browser** — a browsable, filterable timeline of every
  extracted decision per repo; adds file-path metadata at ingestion,
  enabling path-scoped questions ("why is `backend/auth.py` like this?").
- **Markdown export** — copy any answer with citations, ready for PR
  descriptions and docs.
- **Scheduled re-indexing** — interval-based auto-refresh keeping the
  index alive; reuses the Phase 2 job/status machinery.

## Phase 4 — The decision inbox

The differentiator: after each index run, newly extracted decisions land
in a review queue — confirm / edit / discard, with confirmed units
boosted in retrieval. The system writes the ADRs; you approve them.
Scoped when Phase 3 ships.

## Later / parking lot

- **Editor & CLI integration** (`adr why "..."`, VS Code) — meet the
  question where it arises. Deliberately parked until the web product
  proves the core loop.
- **Phase J+ sources: Jira, then Slack (opt-in per channel)** — pushed
  until GitHub is fully proven; same DecisionUnit model, new `kind`s.

## Evaluation

No automated eval harness yet (see SYSTEM-DESIGN.md). Quality is checked
manually against [docs/eval-questions.md](docs/eval-questions.md) — run
each question through `/query` after a retrieval or extraction change
and watch for drift.

## Non-goals (still)

Hosted/multi-user deployment, user accounts, real-time ingestion,
fine-tuning, TypeScript migration. GitHub *authorization* is in scope
(Phase 2); *accounts* are not — adr-engine remains a single-user,
local-first tool whose index never leaves the machine.
