# Automating the organization — design

Status: approved 2026-08-19. Extends ROADMAP.md's delivery model from one
automation to four.

## Why this exists

The existing delivery model is described in ROADMAP.md's "Delivery model"
section:

> Work is delivered by an unattended daily agent picking issues off the
> backlog. The model is designed so the agent can make progress for days
> without a human merging anything.

The reusable workflow that implements this states its own design in a
comment at the top of the file:

> Design: rolling-branch delivery. Skip entirely if the backlog is empty
> (zero cost). Otherwise: fast-forward `agent/rolling` onto `main` (creating
> it from main if absent), attempt up to 3 eligible `daily-task` issues
> (priority-labeled first, then lowest issue number) inside a bounded
> turn/tool budget, commit each completed issue separately, label it
> `in-pr`, and open or update the single rolling PR from `agent/rolling` to
> `main`. Never pushes to the default branch directly — only merging that
> PR does, and only a human does that.

This has worked for two phases of real delivery. Phases 1 and 2 shipped
through this exact loop, and Track A of the v2 design was built and
reviewed through several iterations of it across this project's own
history.

What it does not do:

- **Decide what to build next.** A human has to read the codebase, notice
  gaps, and write specs and issues by hand. Concretely, this is what
  happened for the v2 roadmap and for the Track A/B issue-planning
  sessions: manual, multi-hour, human-driven exploration. The pattern that
  emerged from those sessions — read the code, ground findings in evidence,
  decompose the findings into scoped issues — is mechanical enough to
  describe as a repeatable procedure, but nothing today runs it
  unattended.
- **Review its own output with any independence.** A human reviews the
  rolling PR, but nothing checks that PR before the human looks at it.
  There is no step between "agent finishes work" and "human sees it" where
  a problem could be caught earlier.
- **Resolve feedback without a human noticing there was feedback to
  resolve.** If a human leaves review comments on the rolling PR, nothing
  brings those comments back to the agent's attention. The human has to
  remember to check, and remember again once the agent has acted on them.

This document extends the one-automation model into four, each modeled on
a role a small engineering organization already has: a PM who decides
priority, a scrum master who turns priority into tickets, a developer who
implements tickets, and a reviewer who catches what the developer missed.
The reasoning that makes each of those roles useful for humans applies
unchanged when the role is filled by an unattended agent instead of a
person.

## The organization

| Role | Human analog | Runs |
|---|---|---|
| Coder | Developer | Twice daily: new issues (main window), review feedback (chained after Reviewer) |
| Reviewer | QA / senior developer | Once daily |
| Brainstormer | Product manager | Once daily |
| Issue Generator | Scrum master | Once daily |

The flow between these four follows the shape of an actual org chart. The
Brainstormer decides what the product needs — reading the roadmap, the
Reviewer's report, any open escalations, and security alerts — and writes
that decision into `ROADMAP.md` directly. There is no approval gate on the
Brainstormer's own edits to that file, because the explicit design decision
here is that the Brainstormer's job is to decide, not to propose a change
and wait for someone to approve it. That mirrors how a PM does not submit
a pull request to update the product roadmap; they update it, and the
organization reacts.

The Issue Generator reads `ROADMAP.md` as the Brainstormer left it and
turns it into scoped, dedup-checked GitHub issues, the same sizing and
numbering discipline ROADMAP.md's existing "Issue sizing rules" section
already states. The Coder implements those issues, one independent branch
and PR per issue (see the architecture-change section below for why this
departs from the rolling-branch model). The Reviewer checks the Coder's
output with a structurally independent judgment — a fresh context, no
shared memory with the run that wrote the code being reviewed — and its
report becomes an input the Brainstormer and Issue Generator both read on
their next run.

This closes a loop the single-automation model does not have: no single
automation is both the actor and the sole judge of its own work. The
Coder writes code; the Reviewer, running with no visibility into the
Coder's own reasoning, judges it; the Brainstormer and Issue Generator
turn that judgment into the next cycle's priorities and tickets.

One further rule holds across all four roles, stated here because it
governs how the whole organization surfaces problems to the human: no
automation notifies the human directly except the Brainstormer, and the
Brainstormer sends exactly one email per day, always — a quiet-day
progress digest when there is nothing to flag, a digest with flagged
items folded in when there is. Every other automation's "something needs
attention" surfaces as a label, a report entry, or an issue, never as a
direct notification. This is deliberate: four automations each capable of
independently paging the human would mean four different alerting
systems for what is very often one underlying situation. Funneling every
signal through a single daily digest, described in full in the escalation
section below, prevents that.

## Schedule

| Stage | IST window | UTC cron | Trigger |
|---|---|---|---|
| Coder (new issues) | 12:00am–3:00am | `30 18 * * *` | schedule + 180min random sleep |
| Reviewer | 6:00am–9:00am | `30 0 * * *` | schedule + 180min random sleep |
| Coder (comment resolution) | right after Reviewer | none | workflow_dispatch triggered by Reviewer's final step |
| Brainstormer | 12:00pm–3:00pm | `30 6 * * *` | schedule + 180min random sleep |
| Issue Generator | 6:00pm–9:00pm | `30 12 * * *` | schedule + 180min random sleep |

The four scheduled windows are spaced six hours apart. Claude's usage
window is a rolling five hours, so every stage sits a full hour past the
end of the previous stage's window before the next stage's window could
even begin. No two stages ever compete for the same quota, because by the
time one stage's five-hour window could still be active, the next stage's
window has not yet opened.

The Coder runs twice a day, but it is one automation with two
responsibilities executed in sequence depending on how it is triggered.
The nightly cron invocation (12:00am–3:00am IST) picks up new `daily-task`
issues, exactly as it does today. The second invocation, triggered by the
Reviewer's own final step rather than by a cron entry, checks for review
feedback on the Coder's own currently open PRs first; if there is none, or
once what exists has been resolved, this second invocation exits without
picking up new issues. New-issue pickup stays reserved for the main
nightly window specifically so the two invocations never compete for the
same backlog — a run that both resolves yesterday's feedback and starts
today's new issue would blur the two responsibilities together and make
either one harder to reason about in isolation.

The chained trigger — the Reviewer calling the Coder via
`workflow_dispatch` or `repository_dispatch` at the end of its own run,
rather than a third independent cron entry for comment resolution — keeps
the count at 4 automations with 5 trigger points, not 5 automations. This
matters for the reasoning above: a fifth independently scheduled cron job
would need its own six-hour buffer worked into the rotation, and there is
no natural six-hour slot left in a 24-hour day once the other four are
placed. Chaining off the Reviewer's completion avoids that problem
entirely, because the comment-resolution run only ever starts after the
Reviewer's own window has already closed.

## Architecture change — independent PRs, not a rolling branch

The current design, quoted in full above, is rolling-branch delivery: a
single long-lived branch, one accumulating PR, and a human who reviews the
whole thing whenever they choose. The workflow's own comment states the
reasoning behind that choice explicitly: it "reduces PR review overhead" —
fewer PRs for the human to look at.

That reasoning held when a human was the only reviewer and reviewed
rarely. Fewer PRs meant less context-switching for a person who was
checking in every few days at most. It stops holding once a Reviewer
automation is what gates auto-merge, because a single shared PR means one
flagged item blocks the merge of everything else riding on that branch,
including unrelated work that is already finished and clean. That
directly contradicts the goal of continuous, non-blocking progress: if one
change needs a human's attention, the rest of the day's work should keep
moving, not sit behind it waiting for that one thing to be resolved.

The new model: the Coder creates one branch and one PR per issue, or per
small, logically inseparable batch when an issue is small enough that
batching with an adjacent one is clearly correct — but the default is one
issue, one PR. Each PR is gated independently. If it passes the three
conditions in the next section, it merges on its own schedule. If it's
flagged, it alone waits; every other open PR continues through the
pipeline without it.

The cost of this is named explicitly, not glossed over: more PRs in
aggregate for the human to be aware of, in exchange for each one being
small, self-contained, and never blocked by an unrelated PR's problem.
This is the ordinary tradeoff of small-PR code review against batched
review — a tradeoff every engineering organization that has debated PR
size has already made in one direction or another — not a new tradeoff
invented for this system.

## The merge gate

This is the highest-stakes section of this document.

Today, nothing merges to `main` without a human. This design changes
that: PRs that clear three conditions merge automatically, with no human
in that specific loop. The risk is named once, directly: this closes a
loop where an unattended coder's output is checked only by an unattended
reviewer, with no outside party in the causal chain until the change is
already in `main`. It is fully reversible — git history, nothing external
or destructive — and every condition below is deterministic or
independently verified, not a single model's self-assessment. But the
tradeoff is real, and it was made deliberately here, not overlooked.

**All three of the following are required — this is an AND, not an OR. A
PR that fails any one of them does not merge, and only that PR is
affected; every other open PR keeps moving through the pipeline
independently.**

1. **Required status checks pass.** `pytest` (backend), `npm test` /
   `npm run build` / `npm run lint` (frontend), and — once issues #111 and
   #116 land — the recall@5 eval gate from Track A. Both are open issues
   today: #111 is "Track A #14: CI workflow: pytest + recall@5 harness on
   every backend PR," and #116 is "eval harness's main() still requires
   live Ollama despite claiming otherwise." Until both ship, this
   condition is `pytest` plus the frontend suite only. The recall@5
   requirement is aspirational until its own prerequisite work completes;
   this document does not overstate what exists today.

2. **No touched file matches the sensitive-path denylist**:
   `backend/auth/`, `backend/config_store.py`, `.github/workflows/*`,
   anything migration-shaped, `backend/retrieval/search.py`. This exists
   even though condition 1 already requires passing tests, because
   passing tests proves only that nothing broke that was already covered
   — it says nothing about whether a security- or trust-relevant change
   was actually looked at by a person. A secrets-handling change that
   does not break any existing test is exactly the kind of change a test
   suite is least equipped to catch, precisely because nothing in the
   suite was written with that change in mind.

3. **The Reviewer submits a real GitHub PR review** — `Approve` or
   `Request changes` via the actual GitHub review API, not a comment —
   and that review runs in a hard-isolated fresh context: no shared
   memory, transcript, or reasoning trace with the Coder run that
   produced the PR. This matters because the Reviewer and the Coder are
   the same underlying model. "AI approves AI" is only a meaningful check
   if the reviewer is structurally prevented from simply agreeing with
   itself. Isolation does not guarantee correctness — an isolated
   reviewer can still be wrong — but it guarantees the reviewer never saw
   the coder's own justification to agree with; it has to independently
   re-derive whether the change is right from the diff and the project's
   standards and spec documents alone. This mirrors the interactive
   code-review pattern already used throughout this project's history:
   parallel Standards and Spec sub-agents with no shared context between
   them, used on every PR reviewed in this project to date.

**Enforcement is real, not promised.** As designed today, "never push to
main directly" is a rule written into a script's own instructions —
nothing on GitHub's side enforces it. This was checked live against the
actual repository:

```
$ gh api repos/anubhab-m02/adr-engine/branches/main/protection
{"message":"Branch not protected","documentation_url":"https://docs.github.com/rest/branches/branch-protection#get-branch-protection","status":"404"}
```

`main` currently has zero branch protection. This design turns conditions
1 and 3 above into GitHub branch protection rules — required status
checks and a required approving review, configured via the GitHub API or
repository settings — rather than leaving them as something an agent's
prompt merely promises to respect. Condition 2, the path denylist, is
enforced by the Reviewer's own gating logic before it will submit an
approving review, since GitHub's native branch protection has no
path-based review requirement primitive. This is a real limitation, and
it is stated as one rather than implied away: a compromised or
malfunctioning Reviewer step could theoretically approve a sensitive-path
change despite the intent behind condition 2, since only conditions 1 and
3 have a GitHub-enforced backstop. Condition 2 does not carry the same
enforcement strength as the other two, and this document says so plainly
rather than implying parity that does not exist.

## The shared artifact — the review report

Each Reviewer run writes one file: `docs/superpowers/reports/YYYY-MM-DD-review.md`.
This follows the project's existing convention of writing durable findings
to files under `docs/superpowers/` rather than scattering them across
ephemeral PR comments — the same convention already followed by the
`specs/` and `plans/` directories in this tree.

The report contains a per-PR verdict section — which PRs were reviewed,
which were approved, which were flagged and why — plus a second section
for anything noticed that is not tied to a specific open PR: drift from
the roadmap, a bug spotted while reading code for an unrelated review, a
stale or now-contradicted issue. This second section is what makes
"found while reviewing something else" discoveries systematic rather than
incidental. Issue #95 ("Phase 2 UI state-coverage gaps found in #87
sweep") and issues #111/#116 in this project's own history are exactly
this kind of discovery — previously made by a human or an interactive
session, not by a scheduled review pass. Under this design, the same kind
of discovery happens every day as a side effect of the Reviewer's
ordinary work, rather than only when someone happens to be looking.

Two other automations read this report and act on it. The Brainstormer
folds bug and drift findings into `ROADMAP.md`. The Issue Generator closes
or updates existing issues per the report's per-PR verdicts, and opens new
bug issues from the report's drift/bug section, setting each new bug
issue's priority label from the report's own stated severity. This
requires the report to state severity explicitly per finding — none,
minor, major — so the Issue Generator has something concrete to key
priority off, rather than an inference it would otherwise have to make
itself from a bug's free-text description.

## The review-fix loop

"The reviewer runs again after the coder resolves comments" needs no new
schedule of its own, because the Reviewer's normal daily run already
reviews every currently-open PR, not only newly opened ones. A PR the
Reviewer flagged yesterday, which the Coder's chained comment-resolution
run touched this morning, is simply reviewed again as part of the
Reviewer's ordinary next pass. If it is now clean, it merges. If not, it
stays open, gets flagged again in that day's report, and the Coder's next
comment-resolution run — tomorrow, chained after tomorrow's Reviewer pass
— tries again.

This is deliberately a daily cadence rather than an immediate retry loop.
An immediate same-day third invocation would compete with the day's
already-tight quota spacing, which is the entire reasoning behind the
schedule section above. "The Coder isn't blocked waiting on instant
re-review" was an explicit design goal: the Coder's chained run does its
best against the current feedback and moves on to whatever else it has to
do; the next full day's cycle is the retry mechanism, not a tighter loop
squeezed into the same day.

There is a natural circuit breaker built into this, even without an
explicit mechanism for it: a PR that fails review N days running
accumulates N days of report entries describing the same unresolved
problem. That accumulation is itself a visible signal — both in the daily
email's digest and to a human glancing at the report history — that
something needs direct human intervention rather than another automated
attempt. But there is no automatic hard cutoff in this initial design
(for example, "escalate to a human after 3 failed cycles"). That gap is
named here as a candidate future addition, not silently decided one way
or the other by omission.

## Escalation and the single daily email

This section describes the escalation funnel precisely, because it was
the part of the design most heavily iterated on.

Four sources feed escalation. All four are silent on their own — each
produces a label, a report entry, or an issue, never a direct
notification:

- **The Coder, hitting a genuine blocker**: a new credential or API key
  needed, a new dependency or tech stack being considered, anything with
  a real or potential cost. This extends, rather than replaces, the
  existing rule the automation-kit workflow already states:

  > If a candidate issue has a genuine ambiguity, a design decision only a
  > human should make, a missing credential, or is materially bigger than
  > scoped: stop working on that issue specifically, comment on it
  > explaining what's needed, label it needs-input, and move on to the
  > next candidate instead. Do not guess on judgment calls.

  The three named cases above — credentials, new tech stack, cost — are
  specific instances of "a design decision only a human should make."
  They get their own explicit callout because they are the cases most
  likely to be judged incorrectly by an automation that is, by
  construction, optimizing for "make forward progress."

- **The Reviewer's report**, when it names a bug or a flagged PR.

- **Dependabot and the repository's security alerts**, checked by the
  Brainstormer each run via `gh api repos/{owner}/{repo}/dependabot/alerts`
  (or the equivalent security-advisories endpoint). This needs the
  `security_events` scope, or its equivalent, on the token used — the
  existing `GH_PAT` may not currently carry it. This must be checked
  before this part of the design is implementable, and it is flagged
  here as an open verification item, not assumed to already work.

- **An open `steering`-labeled issue**, described in the next section.

The Brainstormer, and only the Brainstormer, reads all four of the above
each run, and sends the single daily email by updating and assigning the
human to one persistent tracking issue — proposed name: a single pinned
issue, "Daily status," that stays open indefinitely and receives a new
comment plus a fresh assignment each day. GitHub's own assignment
notification mechanism is what fires the email, using the native GitHub
notification path already settled on in the interactive design session
that shaped this document, not a new SMTP-based mailer built for this
purpose.

The content of that daily comment is a digest of the day's progress —
issues completed, PRs merged, PRs still open and why — plus every item
gathered from the four sources above. This is sent every day regardless
of whether anything needs attention: a quiet day produces a short digest,
not silence. Silence was explicitly rejected as a design option, because
a system that says nothing on quiet days becomes indistinguishable, from
the human's side, from a system that has stopped running at all.

## Steering — the interference mechanism

The `steering` label does not exist in the repository's current label set
— confirmed via `gh label list`, which today lists `daily-task`,
`needs-input`, `needs-triage`, `priority`, `in-pr`, and the GitHub
defaults (`bug`, `documentation`, `duplicate`, `enhancement`,
`good first issue`, `help wanted`, `invalid`, `question`, `wontfix`).
Creating `steering` is new work introduced by this design.

The human opens an issue labeled `steering` at any time, with no schedule
implied or required, containing free-form direction — "drop the graph
view idea," "focus on X instead," "this is going in the wrong direction."
The Brainstormer's run checks for open `steering`-labeled issues first,
before reading anything else, and treats their content as binding
instruction that overrides its own judgment for that run. This is not
merely one more input weighed against the roadmap and the review report
alongside everything else; it is a directive. Once the Brainstormer has
incorporated it into `ROADMAP.md`, it closes the issue with a comment
stating specifically what it changed as a result, so the human can verify
the steering was actually followed, not just acknowledged.

This is genuinely interrupt-driven rather than schedule-based, and that
distinction is the point of the mechanism. It costs nothing when unused —
an issue that is never opened has zero effect on any automation's
behavior — and it takes effect on the very next Brainstormer run after it
is opened, whether that is tomorrow or three months from now. There is no
cadence for the human to keep up with here, only a channel that stays
open at all times.

## Issue Generator — dedup and priority

The Issue Generator runs daily against whatever `ROADMAP.md` currently
says, and the Brainstormer's edits to that file are not guaranteed to
shrink — a roadmap item that has not yet been picked up stays listed
until it is. A naive daily pass over the roadmap would therefore refile
the same issues every single day. The Issue Generator must check existing
issue titles and content — open and closed — before filing anything new,
and file only for roadmap items with no existing corresponding issue
anywhere in the tracker's history. Checking closed issues too matters for
a specific reason: a closed issue for something the roadmap still lists
might mean the roadmap itself is stale, which is worth flagging back
rather than blindly reopening the old issue or filing a near-duplicate of
it.

Priority-setting follows the same "state it once, at the source" pattern
used for the review report above. The report's per-finding severity is
what sets a new bug issue's priority label — `priority` for severe
findings, unlabeled (normal backlog order) otherwise — rather than the
Issue Generator inferring severity itself from a bug's description.
Severity is the Reviewer's judgment, stated once at the point it is made;
the Issue Generator's job is routing that judgment into a label, not
re-deriving it from scratch.

## Preparatory work — what has to exist before any of this runs

**New GitHub labels.** `steering` — does not exist today, confirmed via
`gh label list` above.

**Documentation sync.** `ROADMAP.md` still describes the old Phase 3/Phase
4 structure, even though `docs/superpowers/specs/2026-08-04-v2-design.md`
(merged in PR #97, 2026-08-03) superseded it with the wave/track
structure. That migration was promised in the v2 design doc's own
"Documentation changes" table:

> `ROADMAP.md` | Phases 1 and 2 become history; the 23 tracks across 7
> waves replace Phases 3 and 4; non-goals amended for optional team sync

but it was never executed. The Brainstormer's first useful action depends
on `ROADMAP.md` actually reflecting the real current plan, since it reads
that file as ground truth. This is a hard prerequisite, not a
nice-to-have, and it should be done as part of implementing this design,
not left stale for a later cleanup pass.

**Branch protection on `main`.** Configure required status checks
(`pytest`, the frontend suite, recall@5 once available) and require an
approving review, via the GitHub API or repository settings — replacing
today's confirmed zero-protection state.

**New reusable workflows in `automation-kit`.** Three new workflow files
alongside the existing `daily-agent.yml`: a reviewer workflow, a
brainstormer workflow, an issue-generator workflow. Plus modifications to
the existing coder workflow for two things: independent per-issue
branches and PRs instead of the rolling branch, and a second invocation
mode (comment resolution) triggered by the reviewer rather than only
running on its own cron.

**New repo-local workflow files in `adr-engine`.**
`.github/workflows/reviewer.yml`, `brainstormer.yml`,
`issue-generator.yml`, each mirroring how `daily-agent.yml` today just
calls the reusable workflow with repo-specific inputs.

**Credential/scope verification.** Confirm the existing `GH_PAT`'s scopes
cover everything the four new or changed automations need: branch
protection configuration, submitting real PR reviews (not just comments),
reading Dependabot/security alerts (may need an additional scope not
currently granted), and issue assignment. This has not yet been verified
against the actual token in use, and it must be checked before
implementation, not assumed to already work.

**New directory conventions.** `docs/superpowers/reports/`, for Reviewer
output — does not exist yet.

**Credential model, resolved during implementation** (see
`docs/superpowers/plans/2026-08-19-automation-org-implementation.md`,
Task 3): the admin-scoped `GH_PAT` is used by the Brainstormer (writes
`ROADMAP.md`), the Reviewer's report-writing step (writes
`docs/superpowers/reports/*`), the Coder's PR-authoring (so Coder PRs
show as the repository owner, not a bot identity), and the Coder's
comment-resolution job (pushes fix commits, same identity reasoning).
The property that actually matters is narrower than "which paths":
`GH_PAT` never writes to the protected branch itself, only to feature
branches and already-open PRs, which branch protection doesn't govern
at all. The one write to `main` — the merge — always uses the
workflow-scoped default `GITHUB_TOKEN` instead, specifically so branch
protection is not silently bypassed by an admin-owned credential doing
the actual merging.

**A second, more fundamental reason surfaced during Task 14's live dry
run, 2026-09-23**: the Reviewer's own review submission (`gh pr review
--approve`/`--request-changes`) cannot use `GH_PAT` either, for a
reason beyond branch protection entirely — GitHub's API refuses to let
one identity submit a review on its own pull request
("Can not request changes on your own pull request"). Since `GH_PAT`
is the same owner identity that authors every Coder PR, a Reviewer
step using `GH_PAT` to review a Coder PR would always fail. The fix
(same commit) has the Reviewer submit its review via `github.token`
instead — which, beyond just working, is a better fit for the design's
own hard-isolation principle than the original cosmetic goal of every
action showing as the repository owner: the review now genuinely comes
from a distinct identity than whatever opened the PR, not merely a
distinct context window within the same identity. Found and corrected
during a re-review of PRs #170/automation-kit#1, 2026-09-23 — the
original wording overstated the invariant as "only documentation
paths," and this second finding was not caught by that review at all,
only by actually running the workflows.

## What this design deliberately does not do

- No automatic escalation cutoff after N failed review cycles — noted
  above as a candidate future addition, not decided here.
- No hard cap on how many new issues the Brainstormer/Issue Generator may
  introduce per day. A roadmap that grows without bound could in
  principle outpace what the Coder can ever clear. This design does not
  yet define a backlog-growth guardrail, and that gap is named here
  rather than silently assumed away.
- Condition 2 of the merge gate (the sensitive-path denylist) has no
  GitHub-native enforcement backstop, unlike conditions 1 and 3 — stated
  plainly in the merge gate section, repeated here for visibility.
- Dependabot/security-alert integration is designed but not verified
  against actual token scopes — treat as unconfirmed until checked.
- This design does not change who is allowed to force-push, delete
  branches, or otherwise bypass the merge gate directly via git or the
  GitHub UI. Branch protection settings for those separate concerns are
  out of scope here and should be reviewed alongside implementing this
  design, not assumed to be handled by it.

## Summary of what changes, in one table

| | Today | After this design |
|---|---|---|
| Automations | 1 (coder) | 4 (coder, reviewer, brainstormer, issue generator) |
| Branch model | Single rolling branch, one accumulating PR | One branch/PR per issue |
| Merge | Human only | Automatic, gated on 3 conditions; human only on failure |
| Branch protection | None | Required checks + required review |
| New work sourcing | Human reads code, writes issues by hand | Brainstormer decides, Issue Generator tickets it |
| Notification | None (human checks in whenever) | One email daily, always, from the Brainstormer only |
| Human's role | Implementer of ideas, reviewer of PRs, source of new issues | Steers via `steering` issues; resolves what's actually escalated; still owns final say via steering, still receives daily visibility |
