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
>= 70% after Wave 0. Track A (core proving) is complete and the gate is
cleared (recall@5 75.0% vs the 70% floor); Waves 1-6 are unlocked.

## Next up (critical path first, then gate-independent work)

Each item is one PR, ≤150 lines, checkable in CI with no network/Ollama.
The Issue Generator files these as `daily-task` issues.

Critical path: the recall@5 gate is cleared (see Evaluation); no
human-blocked items remain.

Unstarted (test/a11y work found by reading code; #235, #254, #255 merged;
#241 and #256 have PRs awaiting merge):

1. **#257 Library view errors** (DecisionGraph, DecisionTimeline,
   RepoFileTree) announce with `role="alert"`.
2. **#264 CommandPalette dialog test** — assert role/aria-modal, Escape
   closes, focus restored to opener.
3. **#265 local_git error-path tests** — non-repo path / unknown sha
   raise `LocalGitError`.
4. **#266 Unknown-route redirect tests** in `App.test.jsx`.
5. **#269 RepoDecisionsPage document.title** (`"<repo> · Timeline"`).
6. **#270 OnboardingPage document.title** per step.
7. **#271 RepoDecisionsPage** must not crash on malformed percent.
8. **#272 OnboardingPage loading state**.
9. **#273 OnboardingPage progress dots** expose step position.
10. **AnswerPage document.title** (not yet filed) — call
    `useDocumentTitle` in `frontend/src/ask/AnswerPage.jsx` with the
    question text (truncated ~60 chars); assert in `AnswerPage.test.jsx`.
11. **`_resolve_citations` tests** (not yet filed) — in
    `backend/tests/test_answer.py` assert: duplicate ids dedupe in
    first-seen order; ids not in the retrieved units are dropped
    (citations stay traceable); empty units returns the no-coverage
    answer with `[]` and makes no Gemini call.
12. **PrivacyPanel / AnswerPassage a11y** (not yet filed) — add
    `aria-label`/landmark roles to `ask/PrivacyPanel.jsx` and
    `ask/AnswerPassage.jsx` (zero aria attributes today); assert via
    `getByRole` in their existing tests.

With the gate cleared, the next unstarted work beyond the items above is
the remainder of Track B (reading surfaces) in the v2 design doc.

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
- **PR #206 is a superseded duplicate** of the work merged in #209;
  close it if still open.

## Later / parking lot

- **Editor & CLI integration** (`adr why "..."`, VS Code) — meet the
  question where it arises. Parked until the web product proves the core
  loop.
- **Phase J+ sources: Jira, then Slack (opt-in per channel)** — pushed
  until GitHub is fully proven; same DecisionUnit model, new `kind`s.
- **Golden-set growth (10 → ~40 questions)** across both repos, needing
  real expected SHAs; human-assisted, now unblocked.

## Evaluation

Harness (`backend/eval/harness.py`), golden questions
(`docs/eval-questions.md`), and the recall@5 gate design (70% floor, 50%
broken, 5-point ratchet) are in place, and `.github/workflows/backend-tests.yml`
runs `pytest` plus the recall@5 step. `.github/workflows/frontend-tests.yml`
runs frontend lint/test/build.

The frozen fixture (`backend/eval/fixtures/`, built by
`backend/eval/build_fixture.py`, #108) is checked in: 105 units, recall@5
75.0%, above the 70% floor, so the CI gate is live. Misses are extraction
coverage, not ranking, so the k/RELEVANCE_FLOOR sweep (#112) was closed
as unneeded; reopen only for headroom.

## Non-goals (still)

Hosted/multi-user deployment, user accounts, real-time ingestion,
fine-tuning, TypeScript migration. GitHub *authorization* is in scope
(Phase 2); *accounts* are not — adr-engine remains a single-user,
local-first tool whose index never leaves the machine.

## Accepted risks

Decided 2026-10-31 by the owner; settled, do not re-raise.

- **chromadb 0.6.3 (3 CVEs: 1 critical, 2 high; no patched version exists).** Chroma runs in-process via `PersistentClient` — no HTTP server, no multi-tenant RBAC surface, no `trust_remote_code` use. Not reachable in this deployment. Revisit only if a networked/shared Chroma server is ever introduced.
- **Dev-only npm findings (vite dev server / launch-editor, @vitest/mocker, source-map-js).** Build and test tooling only, never shipped to users; `launch-editor` is absent from the lockfile. Apply fixes only when a clean Dependabot PR appears.

## Latest update — 2026-11-16

- No steering issues; no open needs-input. Review report 2026-11-16
  approved #259, #260, #274, #275, #276; #259, #274, #275 merged.
- Dependabot API succeeded. Open alerts (chromadb, vite, @vitest/mocker)
  are all Accepted risks; nothing new.
- Eligible backlog 11 issues; roadmap lists 12 unstarted items (10-12
  await issue filing).
