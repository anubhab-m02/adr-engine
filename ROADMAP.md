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

## Phase 1 — MVP: GitHub only (complete)

Ask a question about indexed repos in the React UI and get a correctly
cited answer, end to end, locally. All batches (A–F) delivered.

## Phase 2 — Productization (shipped; polish only)

A stranger can run adr-engine without touching a config file. Form
factor locked by [PRODUCT.md](PRODUCT.md): **local-first product** — no
user accounts, no hosting; "login" is GitHub authorization via OAuth
device flow. UX/visual spec: [docs/UI-DESIGN.md](docs/UI-DESIGN.md)
(binding); API contracts: [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md).

Batches G–K (config store + GitHub auth, background ingestion, app shell
and onboarding, the reading room, Library and Settings) are shipped, as
are the decision timeline/graph views, FileTree library route, and
UI-DESIGN.md Ask-section reconciliation. Batch L (hardening: responsive,
a11y verification, state-coverage sweep) is the remaining Phase 2 work
and is represented by the gate-independent items below.

## After Phase 2

The wave/track structure in
[docs/superpowers/specs/2026-08-04-v2-design.md](docs/superpowers/specs/2026-08-04-v2-design.md)
is the source of truth: 23 tracks across 7 waves, gated behind recall@5
>= 70% after Wave 0. Track A (core proving) is built except the two
human-run steps below.

## Next up (critical path first, then gate-independent work)

Each item is one PR, ≤150 lines, checkable in CI with no network/Ollama.
The Issue Generator files these as `daily-task` issues.

Critical path — needs a human (both `needs-input`):

1. **#108 — build the frozen eval fixture.** A human runs
   `backend/eval/build_fixture.py` (per
   `docs/superpowers/plans/2026-08-04-track-a-core-proving.md` Task 11)
   against a live local Ollama and commits `backend/eval/fixtures/`.
   Activates the recall@5 CI gate. Top human action.
2. **#112 — sweep k and RELEVANCE_FLOOR** against the harness. Blocked
   on #108. (`backend/retrieval/search.py` is sensitive-path: human merge.)

Gate-independent (unstarted, all test/a11y/doc work found by reading code):

3. **Test `parseAnswer`** — new `frontend/src/ask/parseAnswer.test.js`.
   Citation-marker parsing is load-bearing. Cover: unknown ids stay
   literal text, numbering follows first appearance across paragraphs,
   repeated ids reuse a number, blank paragraphs dropped, empty answer.
4. **Test `sourceFormat`** — new `frontend/src/lib/sourceFormat.test.js`
   covering each exported formatter's normal, empty, and malformed input.
5. **Test `TopNav`** — new `frontend/src/shell/TopNav.test.jsx`: nav
   landmark has an accessible name, active route sets `aria-current`,
   every link reachable by keyboard.
6. **Test `InlineConfirm`** — new
   `frontend/src/components/InlineConfirm.test.jsx`: confirm/cancel
   callbacks, Escape cancels, focus lands on the safe action first.
7. **Test `useNewQuestion`** — new
   `frontend/src/lib/useNewQuestion.test.jsx` (hook behavior, navigation
   target, state reset).
8. **Test `SourceCardList` and `RepoDecisionsPage`** — new
   `frontend/src/ask/SourceCardList.test.jsx` and
   `frontend/src/library/RepoDecisionsPage.test.jsx`: empty, loading,
   error, and populated states; one card per citation, each linking to
   its commit/PR URL.
9. **Test `chroma_client`** — new `backend/tests/test_chroma_client.py`:
   honors `CHROMA_DATA_DIR` (use `tmp_path`), falls back to the default
   path, and `lru_cache` returns one shared instance
   (`get_chroma_client.cache_clear()` in setup/teardown).
10. **Test `ollama_client`** — new
    `backend/tests/test_ollama_client.py` with a mocked HTTP layer: happy
    path, connection error and non-200 surface a clear exception,
    timeout honored. No live Ollama.
11. **Ingestion idempotency regression test** — extend
    `backend/tests/test_ingestion_run.py`: run `run_ingestion` twice over
    the same fake commits/PRs and assert the Chroma collection count and
    ids are unchanged after the second run (CLAUDE.md convention).
12. **Citation traceability test** — extend
    `backend/tests/test_answer.py`: every id cited in a synthesized answer
    maps back to a retrieved unit with a commit/PR URL, and ids not in the
    retrieved set are not returned as citations.
13. **Skip-to-content link and `<main>` landmark** — modify
    `frontend/src/shell/AppShell.jsx` (+ `AppShell.test.jsx`) so keyboard
    users can bypass the nav (WCAG 2.4.1). No existing skip link in the
    frontend.
14. **Test `ingestion/github_client.py` pagination and rate-limit
    branches** — extend `backend/tests/test_github_client.py` (250-line
    module, largest ingestion file): multi-page fetch, empty repo,
    403 rate-limit response.

When the gate clears (#108 then #112 done), the next unstarted work is
Track B (reading surfaces) in the v2 design doc.

## Known gaps

- **#190 — bot-merge issue closing is unconfirmed.** `Closes #N` did not
  auto-close issues for PRs merged by `github-actions[bot]` (default
  `GITHUB_TOKEN` suppresses downstream events). automation-kit now merges
  with `GH_PAT` and `reviewer.yml` has a `pull_request: closed` trigger;
  stays open until a bot-merge is seen closing its linked issue. Until
  then, close linked issues by hand after a bot merge.
- **No conflict handling for approved-but-conflicting PRs.** The Reviewer
  re-approves a PR whose merge state is `dirty` daily without flagging it,
  and nothing makes the Coder rebase. Worth fixing in automation-kit (skip
  or flag dirty PRs; have the Coder rebase conflicted branches). Not an
  adr-engine daily-task.
- **Automation health (#215, watchdog).** No code PR merged in 7 days
  because the eligible backlog hit 0 (only #108/#112 remain, both
  human-blocked). The 14 items above restore supply; the Coder should
  resume once the Issue Generator files them.
- **PR #206 is a superseded duplicate** of the work merged in #209;
  close it if still open.

## Later / parking lot

- **Editor & CLI integration** (`adr why "..."`, VS Code) — meet the
  question where it arises. Parked until the web product proves the core
  loop.
- **Phase J+ sources: Jira, then Slack (opt-in per channel)** — pushed
  until GitHub is fully proven; same DecisionUnit model, new `kind`s.
- **Golden-set growth (10 → ~40 questions)** across both repos, needing
  real expected SHAs; human-assisted, do after #108.

## Evaluation

Harness (`backend/eval/harness.py`), golden questions
(`docs/eval-questions.md`), and the recall@5 gate design (70% floor, 50%
broken, 5-point ratchet) are in place, and `.github/workflows/backend-tests.yml`
runs `pytest` plus a recall@5 step that is a no-op until the frozen
fixture exists. `.github/workflows/frontend-tests.yml` runs frontend
lint/test/build.

The one blocker: the frozen fixture
(`backend/eval/fixtures/decision_units.json`, `embeddings.json`,
`golden_question_embeddings.json`) is not checked in and
`backend/eval/build_fixture.py` does not exist (#108, expanded by #171).
Generating it needs real ingestion against a live local Ollama, which no
unattended automation can do. Until it lands, UI work ships without the
recall@5 quality bar the v2 design calls for. Fallback: run each
question in `docs/eval-questions.md` through `/query` after retrieval or
extraction changes and watch for drift.

## Non-goals (still)

Hosted/multi-user deployment, user accounts, real-time ingestion,
fine-tuning, TypeScript migration. GitHub *authorization* is in scope
(Phase 2); *accounts* are not — adr-engine remains a single-user,
local-first tool whose index never leaves the machine.

## Accepted risks

Decided 2026-10-31 by the owner; settled, do not re-raise.

- **chromadb 0.6.3 (3 CVEs: 1 critical, 2 high; no patched version exists).** Chroma runs in-process via `PersistentClient` — no HTTP server, no multi-tenant RBAC surface, no `trust_remote_code` use. Not reachable in this deployment. Revisit only if a networked/shared Chroma server is ever introduced.
- **Dev-only npm findings (vite dev server / launch-editor, @vitest/mocker, source-map-js).** Build and test tooling only, never shipped to users; `launch-editor` is absent from the lockfile. Apply fixes only when a clean Dependabot PR appears.

## Latest update — 2026-10-31

- No steering issues; no new review report (latest 2026-10-21). Dependabot
  API succeeded: 12 open alerts (6 chromadb, 6 vite/@vitest/mocker), all
  covered by Accepted risks, so none roadmapped.
- Eligible backlog was 0 (the cause of #215). Added items 3-14 to "Next
  up" and condensed this file from 570 to ~270 lines (dated updates and
  resolved history removed).
