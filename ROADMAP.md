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

## Product decisions (resolved 2026-09-22, status as of 2026-09-24)

These were filed `needs-input` pending a PM-level call, not a missing
implementation. All three were promoted to `daily-task`; status below.

- **#173 UI-DESIGN.md Ask-section reconciliation — shipped.** PR #205
  merged 2026-09-26, rewriting the Ask section to document the shipped
  margin-citation grid as the binding spec. Manually closed 2026-09-26
  (same bot-merge gap as below). Spun off one follow-up, #204
  (`needs-triage`): `AskPage.jsx`'s `max-w-3xl` thread wrapper caps the
  page below the grid's 900/1280px tiers.
- **#194 Mount FileTree in a Library route — in flight.** Promoted to
  `daily-task`; PR #206 (adds `/library/:repo/files`, wires
  `AskPage.jsx` to consume `prefillQuestion` nav state) is open,
  reviewed and approved 2026-09-26, not yet merged.
- **#138 Decision graph view — no new dependency.** Shipped: PR #188
  merged 2026-09-23 (static grid/date layout, no `d3-force`). Was
  manually closed 2026-09-23 after sitting falsely `OPEN` — see the
  bot-merge gap below. Unblocked #139/#140, both now also shipped.
- **#129 LoadingCard — client-side two-state, no backend change.**
  Shipped: PR #189 merged 2026-09-23 (single honest in-flight message,
  no polled backend). Manually closed 2026-09-23, same gap.
- **#145 File-tree click-to-scope — two calls (caret vs. name-text
  click target; frontend-only pre-fill, backend path filter deferred
  to its own issue).** Shipped: PR #193 merged 2026-09-24. Its two
  routing/graph follow-ups also shipped the same day — #139 (timeline/
  graph view routing and toggle, PR #191) and #140 (graph node click
  navigates to decision detail, PR #192). All three (#139, #140, #145)
  are now closed.

## Known gap — bot-merged PRs aren't auto-closing linked issues (found 2026-09-23)

`Closes #N` in a PR body has auto-closed the issue on merge for every
PR in this repo's history merged by a human (`anubhab-m02`) — but the
two most recent daily-task PRs, both merged by the `github-actions[bot]`
actor, did not: #188 ("Closes #138", merged 2026-09-23T07:37:53Z) and
#189 ("Closes #129", merged 2026-09-23T07:29:21Z) both left their linked
issue open despite the work being complete and merged. No workflow in
`.github/workflows/` currently calls `gh issue close` as a fallback —
the design relies entirely on GitHub's implicit keyword-closing, which
this data point shows isn't reliable for bot-actuated merges here.

This is load-bearing for the delivery model's own issue state machine
("merging closes the issue via `Closes #N`") — left alone, completed
daily-task issues will keep silently piling up as falsely `OPEN`,
eventually reading as backlog that's actually already done. Filing as
`needs-input` (tracked as #190) rather than `daily-task`: the fix
almost certainly means adding an explicit `gh issue close` step to the
merge automation, which lives under `.github/workflows/*` — a
sensitive path the merge gate itself excludes from normal daily-task
auto-merge, so this can't just be picked up and shipped like an
ordinary issue; a human needs to land it.

**Update 2026-09-24:** #138 and #129 were manually closed, but the gap
recurred immediately on the next batch — PRs #191 ("Closes #139"),
#192 ("Closes #140"), and #193 ("Closes #145"), all merged by
`github-actions[bot]` on 2026-09-24, again left their linked issues
`OPEN` despite complete, merged work. Two-for-two on bot-merged PRs now
failing to auto-close is enough to call this systemic rather than a
one-off; #190 fixing it should be treated as higher priority among the
`needs-input` items, not just tracked passively. In the meantime,
#139, #140, and #145 need the same manual closure #138/#129 got.

**Update 2026-09-25:** recurred a third time — PR #195 ("Closes
#172", privacy panel fix) and PR #196 ("Closes #186", pytest bump),
both merged by `github-actions[bot]` on 2026-09-25, again left #172
and #186 `OPEN` despite complete, merged work. Manually closed both
today. Three-for-three now; #190 stays the top `needs-input` item
until someone lands an explicit `gh issue close` fallback step in the
merge workflow (still blocked on a human because it touches
`.github/workflows/*`, a sensitive path the auto-merge gate itself
excludes).

**Update 2026-09-26 — the fix landed but doesn't work; root cause
found.** #190 was closed 2026-09-25 by commit 56beda1, which added a
`pull_request: closed` trigger to adr-engine's own `reviewer.yml` to
close linked issues explicitly. It didn't help: PR #205 ("Closes
#173") and PR #207 ("Closes #201"), both merged by `github-actions[bot]`
on 2026-09-26 *after* that fix was live, again left their linked
issues `OPEN`. Checked the workflow run history directly — every
`reviewer.yml` run since the fix landed is `schedule` or
`workflow_dispatch`; there has never been a single `pull_request`-
triggered run. Root cause: the actual merge happens inside the shared
reusable workflow (`anubhab-m02/automation-kit/.github/workflows/reviewer.yml`,
step "Extract verdict and submit the real GitHub review") via `gh pr
merge --squash --auto` run with `GH_TOKEN: ${{ github.token }}` — the
default `GITHUB_TOKEN`, not `GH_PAT`. GitHub does not fire downstream
workflow runs (including `pull_request` events on the same repo) for
actions performed with the default `GITHUB_TOKEN` — this is documented
platform behavior to prevent recursive triggering, not a flake. That
means the trigger #190's fix added is structurally incapable of ever
firing for these auto-merges; it's dead code, not a rare miss.
Reopened #190 with this diagnosis. Manually closed #173 and #201
today, same as every prior occurrence. Two real fixes exist, both
needing a human:
1. Change automation-kit's merge step to use `GH_PAT` instead of
   `github.token` (that secret is already threaded through the same
   workflow for the report commit) — but automation-kit is a separate,
   shared repo, so this isn't an adr-engine daily-task.
2. Add a scheduled fallback sweep to adr-engine's own `reviewer.yml`
   that periodically scans recently-merged PRs for unclosed linked
   issues, independent of the `pull_request` trigger — doable within
   this repo, but still touches `.github/workflows/*`, so it needs a
   human to land it, same as every other candidate fix for this gap.

## Process note

Dependabot alerts were re-checked on 2026-09-22 (later the same day this
file was first updated) and are now enabled for this repository — a
human must have flipped the repo setting. The very first re-check
returned `200 []` (indexing lag right after enabling); a follow-up
seconds later returned 18 real open alerts, confirmed by GitHub's own
push-time warning ("18 vulnerabilities: 2 critical, 6 high, 10
moderate"). Treat a `[]` response right after alerts get enabled as
possibly stale, not as ground truth — re-check before reporting zero.

## Security — open dependency alerts (found 2026-09-22, re-checked 2026-09-25)

Of the original 18, 12 are now `fixed` via merged Dependabot/daily-task
PRs: react-router (#181), undici (#180), python-dotenv (#177, closed
issue #185), postcss + nanoid (#178), and pytest (#196, closed issue
#186 — see the bot-merge note above). 6 remain open, all the same
group as yesterday, already tracked — nothing new to file here today:

- **chromadb — 1 critical + 2 high, no patch yet.** Same three CVEs as
  before (CVE-2026-45833 critical, CVE-2026-45831/CVE-2026-45830
  high), duplicated across `backend/requirements.txt` and
  `backend/requirements-dev.txt` (6 alerts, 3 unique, unchanged since
  2026-09-22). Tracked as `needs-input` issue #187, pending a
  risk-acceptance call — still no upstream version bump that fixes
  this, so there's nothing for Dependabot to open a PR against yet.

## Later / parking lot

- **Editor & CLI integration** (`adr why "..."`, VS Code) — meet the
  question where it arises. Deliberately parked until the web product
  proves the core loop.
- **Phase J+ sources: Jira, then Slack (opt-in per channel)** — pushed
  until GitHub is fully proven; same DecisionUnit model, new `kind`s.

## Evaluation

Harness code (`backend/eval/harness.py`), golden questions
(`docs/eval-questions.md`), and the recall@5 gate design (70% floor, 50%
broken, 5-point ratchet — #109) are all in place. **CI enforcement
landed 2026-09-25:** `.github/workflows/backend-tests.yml` (commit
a66653d, closing #111 and #42) now runs `pytest` on every backend-
touching PR, plus a recall@5 step that's a no-op until the frozen
fixture exists, then auto-enforces once it does. Since that's a
workflow-path change, a human merged it directly (outside the normal
auto-merge gate, which excludes `.github/workflows/*`).

The one remaining blocker is unchanged: the frozen fixture the harness
reads (`backend/eval/fixtures/decision_units.json`, `embeddings.json`,
`golden_question_embeddings.json`) is never checked in, and the script
that's supposed to generate it, `backend/eval/build_fixture.py`, doesn't
exist either (#108, expanded by #171). Generating it requires a human
running real ingestion against a live local Ollama instance — not
something any of the four unattended automations can do — so #108 stays
`needs-input` and is the **single highest-priority human action item**
in this roadmap right now: it's the only thing standing between the
now-wired-up CI gate and it actually enforcing anything, and it also
blocks retrieval tuning (#112, confirmed still blocked as of
2026-09-26). #171's scope (also emit `golden_question_embeddings.json`)
means `eval/harness.py` won't need a live Ollama call at run time either
— folded into #108's scope rather than tracked separately.

Worth naming plainly: until #108 lands, Track B UI work keeps shipping
without the recall@5 quality bar the delivery model itself calls for
("gated behind a recall@5 quality bar after Wave 0"). That gate has
never actually been enforced since Wave 0 began — it's wired up now,
but still dormant.

Manual verification against docs/eval-questions.md remains the fallback
until the harness is runnable — run each question through `/query`
after a retrieval or extraction change and watch for drift.

## Non-goals (still)

Hosted/multi-user deployment, user accounts, real-time ingestion,
fine-tuning, TypeScript migration. GitHub *authorization* is in scope
(Phase 2); *accounts* are not — adr-engine remains a single-user,
local-first tool whose index never leaves the machine.
