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

Work is delivered by four unattended automations, each modeled on a role
a small engineering org already has. Full design:
[docs/superpowers/specs/2026-08-19-automation-org-design.md](docs/superpowers/specs/2026-08-19-automation-org-design.md).

- **Coder** (dev): picks up `daily-task` issues, one independent branch
  and PR per issue — not a shared rolling branch. Runs nightly
  (12am-3am IST) for new issues, and again right after the Reviewer
  (triggered, not scheduled) to resolve review feedback on its own open
  PRs.
- **Reviewer** (QA): reviews every currently open PR in a hard-isolated
  fresh context per PR — no shared memory with the Coder run that
  produced it. Submits a real GitHub review (`Approve`/`Request
  changes`) and writes a dated report to
  `docs/superpowers/reports/`. Runs 6am-9am IST.
- **Brainstormer** (PM): reads the latest report, open `steering`-labeled
  issues (checked first, treated as binding), open `needs-input` issues,
  and the repo's security alerts; updates this file directly — no
  approval gate on its own edits. Sends the one daily notification.
  Runs 12pm-3pm IST.
- **Issue Generator** (scrum master): reads this file and the latest
  report; files new, dedup-checked issues; closes/updates existing ones
  per the report; sets `priority` from the report's stated severity.
  Runs 6pm-9pm IST.

**Merge gate** (all three required — an AND, enforced by real GitHub
branch protection, not just workflow instructions):
1. Required status checks pass (`pytest`, `npm test`/build/lint, and the
   recall@5 gate once available).
2. No touched file matches the sensitive-path denylist:
   `backend/auth/`, `backend/config_store.py`, `.github/workflows/*`,
   anything migration-shaped, `backend/retrieval/search.py`.
3. The Reviewer's isolated review approves.

- **Issue state machine:** `daily-task` (eligible) → agent completes it
  and opens its own PR → the merge gate above decides automatically →
  merging closes the issue via `Closes #N`. `needs-input` marks issues
  blocked on a human (never notifies directly — the Brainstormer folds
  it into the daily digest). `needs-triage` marks agent-proposed
  follow-ups awaiting promotion. `steering` is how a human redirects the
  Brainstormer, at any time, no schedule required.
- **Issue sizing rules (binding, unchanged):**
  - One module or one component per issue; target diff ≤ ~150 lines
    excluding fixtures.
  - Every issue names exact files to create/modify and acceptance
    criteria checkable by `pytest`/`npm test` in CI (no network, no
    Ollama — see ARCHITECTURE.md testing conventions).
  - Issues are numbered in dependency order.
- **Human's role:** steer via `steering` issues, whenever; resolve
  whatever the daily email actually flags; nothing else is required to
  keep the organization moving.

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

## Phase 3 and 4 — superseded

Superseded by the wave/track structure in
[docs/superpowers/specs/2026-08-04-v2-design.md](docs/superpowers/specs/2026-08-04-v2-design.md)
(merged via #97). That document is the current source of truth for
everything after Phase 2 — 23 tracks across 7 waves, gated behind a
recall@5 quality bar after Wave 0. This section is kept only so a reader
following Phase 2 forward knows where the plan actually continues.

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
