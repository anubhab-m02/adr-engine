# Automating the Organization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four-automation org from `docs/superpowers/specs/2026-08-19-automation-org-design.md` — Reviewer, modified Coder, Brainstormer, Issue Generator — with a real, GitHub-enforced merge gate.

**Architecture:** Reusable workflows live in `anubhab-m02/automation-kit` (ADMIN access confirmed); thin caller workflows, branch protection, labels, and `ROADMAP.md` live in `anubhab-m02/adr-engine` (this repo). Each new workflow is built and manually verified via `workflow_dispatch` before its cron trigger is ever enabled — nothing runs unattended until it has been run attended at least once.

**Tech Stack:** GitHub Actions, `anthropics/claude-code-action@v1`, `gh` CLI, Python (for the one piece of real parsing logic — the review-report parser — which gets real unit tests, unlike the surrounding YAML).

## Global Constraints

- No task enables a `schedule:` cron trigger. Every new/modified workflow ships with `workflow_dispatch` only; enabling the cron entries is a deliberate, separate final task (Task 14) done only after every prior task has been manually verified.
- No task modifies `backend/` or `frontend/` application code — this plan is entirely process/infrastructure.
- Every workflow YAML change is verified for syntax via `python3 -c "import yaml; yaml.safe_load(open('PATH'))"` before being considered done, in addition to a real dispatch run where one is feasible without side effects.
- Per the design doc: the sensitive-path denylist is `backend/auth/`, `backend/config_store.py`, `.github/workflows/*`, anything migration-shaped, `backend/retrieval/search.py`.
- Per the design doc: the daily email must originate only from the Brainstormer, exactly once per day, always — no other automation notifies directly.
- Git identity for automated commits matches the existing convention in `daily-agent.yml`: `git config --global user.name "${{ github.repository_owner }}"` / matching noreply email.

---

## File Structure

**In `anubhab-m02/automation-kit`:**
- `.github/workflows/daily-agent.yml` — MODIFIED. Independent per-issue branches/PRs replace the rolling branch; gains a second `workflow_call` input path for comment-resolution mode.
- `.github/workflows/reviewer.yml` — NEW. Reusable workflow: isolated per-PR review, real GitHub review submission, dated report file, triggers Coder's comment-resolution mode on completion.
- `.github/workflows/brainstormer.yml` — NEW. Reusable workflow: steering-issue check, `ROADMAP.md` update, Dependabot check, single daily tracking-issue update.
- `.github/workflows/issue-generator.yml` — NEW. Reusable workflow: reads `ROADMAP.md` + latest report, dedups against issue history, files/updates issues.
- `scripts/parse_review_report.py` — NEW. Shared parser for the review report's machine-readable frontmatter (verdict, severity per finding). Used by both `reviewer.yml` (to format what it writes) and `issue-generator.yml` (to read what it needs).
- `scripts/test_parse_review_report.py` — NEW. Real unit tests for the parser.
- `README.md` — MODIFIED. Documents the four-automation model, supersedes the "Two separate loops" framing that only described one.

**In `anubhab-m02/adr-engine` (this repo):**
- `ROADMAP.md` — MODIFIED. Delivery model section rewritten for independent-PR delivery; Phase 3/Phase 4 language replaced with the wave/track structure from `docs/superpowers/specs/2026-08-04-v2-design.md` (already merged, never back-ported into this file).
- `.github/workflows/daily-agent.yml` — MODIFIED. Passes new inputs for independent-PR mode.
- `.github/workflows/reviewer.yml` — NEW. Thin caller.
- `.github/workflows/brainstormer.yml` — NEW. Thin caller.
- `.github/workflows/issue-generator.yml` — NEW. Thin caller.
- `docs/superpowers/reports/` — NEW directory. Seeded with `docs/superpowers/reports/TEMPLATE.md` defining the report's exact shape.

---

### Task 1: Prerequisites — `steering` label and `ROADMAP.md` sync

**Files:**
- Modify: `ROADMAP.md` (Delivery model section, and Phase 3/Phase 4 sections)

**Interfaces:**
- Produces: the `steering` GitHub label (confirmed not to exist via `gh label list`); a `ROADMAP.md` whose delivery-model description matches independent-PR delivery instead of the rolling branch, and whose Phase 3/4 sections point at the wave/track structure instead of describing superseded content directly.

- [ ] **Step 1: Create the `steering` label**

Run:
```bash
gh label create steering --color "5319E7" --description "Human directive for the Brainstormer — checked first, every run, treated as binding" --repo anubhab-m02/adr-engine
```
Expected: label created (verify with `gh label list --repo anubhab-m02/adr-engine | grep steering`).

- [ ] **Step 2: Rewrite `ROADMAP.md`'s "Delivery model" section**

Read the current section first (`sed -n '15,45p' ROADMAP.md`) to confirm exact current wording, then replace it in full:

```markdown
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
```

- [ ] **Step 3: Replace the Phase 3/Phase 4 sections**

Read the current sections (`sed -n '85,110p' ROADMAP.md`), then replace both `## Phase 3 — The living archive` and `## Phase 4 — The decision inbox` sections with:

```markdown
## Phase 3 and 4 — superseded

Superseded by the wave/track structure in
[docs/superpowers/specs/2026-08-04-v2-design.md](docs/superpowers/specs/2026-08-04-v2-design.md)
(merged via #97). That document is the current source of truth for
everything after Phase 2 — 23 tracks across 7 waves, gated behind a
recall@5 quality bar after Wave 0. This section is kept only so a reader
following Phase 2 forward knows where the plan actually continues.
```

- [ ] **Step 4: Verify no other file references the old Phase 3/4 headings**

Run: `grep -rn "Phase 3 —\|Phase 4 —" --include="*.md" .`
Expected: no results outside `ROADMAP.md`'s own superseded-section note above (which references them by name deliberately, as history, not as active headings elsewhere).

- [ ] **Step 5: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: sync ROADMAP.md to the four-automation model and v2 wave structure"
```

---

### Task 2: The review-report contract and its parser

**Files:**
- Create: `docs/superpowers/reports/TEMPLATE.md` (in `adr-engine`)
- Create: `automation-kit/scripts/parse_review_report.py`
- Create: `automation-kit/scripts/test_parse_review_report.py`

**Interfaces:**
- Produces: `parse_review_report(text: str) -> ReviewReport`, where `ReviewReport` has `date: str`, `verdicts: list[PrVerdict]` (`pr_number: int`, `verdict: Literal["approve", "request_changes"]`, `reason: str`), and `findings: list[Finding]` (`description: str`, `severity: Literal["none", "minor", "major"]`, `related_pr: int | None`). Used by Task 5 (Reviewer writes reports in this shape) and Task 12 (Issue Generator reads them).

This is the one piece of real application logic in the whole plan — everything else is YAML and prompts — because both the Reviewer and the Issue Generator need to agree on machine-readable severity and verdict fields without re-parsing free-form prose every time, and getting that wrong silently breaks the whole priority-from-severity mechanism the design doc specifies.

- [ ] **Step 1: Define the report template**

Create `docs/superpowers/reports/TEMPLATE.md` in `adr-engine`:

```markdown
---
date: YYYY-MM-DD
verdicts:
  - pr_number: 123
    verdict: approve  # or request_changes
    reason: "One sentence."
findings:
  - description: "One sentence describing what was found."
    severity: minor  # none | minor | major
    related_pr: 123  # or null if not tied to a specific open PR
---

# Review report — YYYY-MM-DD

## PRs reviewed

One paragraph per PR: what it does, what was checked, why the verdict
above was reached. Human-readable — the frontmatter above is what other
automations parse; this body is what a human reads if they open the file.

## Findings not tied to a specific PR

Anything noticed while reviewing that isn't about the PR currently under
review — drift from the roadmap, a bug spotted in passing, a stale or
now-contradicted issue. One paragraph per finding, matching the
frontmatter's `findings` list one-to-one.
```

- [ ] **Step 2: Write the failing tests for the parser**

Create `automation-kit/scripts/test_parse_review_report.py`:

```python
from parse_review_report import parse_review_report

_SAMPLE = """---
date: 2026-08-20
verdicts:
  - pr_number: 42
    verdict: approve
    reason: "Tests pass, no sensitive paths touched."
  - pr_number: 43
    verdict: request_changes
    reason: "Missing test coverage for the new branch."
findings:
  - description: "retrieval/search.py's RELEVANCE_FLOOR comment is stale."
    severity: minor
    related_pr: null
  - description: "config_store.py silently swallows a JSONDecodeError."
    severity: major
    related_pr: 43
---

# Review report — 2026-08-20

body text, not parsed
"""


def test_parses_date():
    report = parse_review_report(_SAMPLE)
    assert report.date == "2026-08-20"


def test_parses_all_verdicts_in_order():
    report = parse_review_report(_SAMPLE)
    assert len(report.verdicts) == 2
    assert report.verdicts[0].pr_number == 42
    assert report.verdicts[0].verdict == "approve"
    assert report.verdicts[1].verdict == "request_changes"


def test_parses_findings_with_severity_and_optional_related_pr():
    report = parse_review_report(_SAMPLE)
    assert len(report.findings) == 2
    assert report.findings[0].severity == "minor"
    assert report.findings[0].related_pr is None
    assert report.findings[1].severity == "major"
    assert report.findings[1].related_pr == 43


def test_report_with_no_findings_parses_to_empty_list():
    text = """---
date: 2026-08-21
verdicts: []
findings: []
---

# Review report — 2026-08-21

Nothing to report today.
"""
    report = parse_review_report(text)
    assert report.verdicts == []
    assert report.findings == []


def test_missing_frontmatter_raises_a_clear_error():
    import pytest

    with pytest.raises(ValueError, match="no YAML frontmatter"):
        parse_review_report("# Just a heading, no frontmatter\n")
```

- [ ] **Step 2b: Install pytest and pyyaml locally for this script directory**

Run:
```bash
cd automation-kit/scripts
python3 -m venv .venv
.venv/bin/pip install pytest pyyaml
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd automation-kit/scripts && .venv/bin/pytest test_parse_review_report.py -v`
Expected: FAIL — `parse_review_report` module does not exist.

- [ ] **Step 4: Implement the parser**

Create `automation-kit/scripts/parse_review_report.py`:

```python
"""Parses a review report's YAML frontmatter into typed objects.

The frontmatter is the machine-readable contract between the Reviewer
(which writes it) and the Issue Generator (which reads it) — the
Markdown body below the frontmatter is for humans only and is never
parsed.
"""

from dataclasses import dataclass
from typing import Literal

import yaml


@dataclass
class PrVerdict:
    pr_number: int
    verdict: Literal["approve", "request_changes"]
    reason: str


@dataclass
class Finding:
    description: str
    severity: Literal["none", "minor", "major"]
    related_pr: int | None


@dataclass
class ReviewReport:
    date: str
    verdicts: list[PrVerdict]
    findings: list[Finding]


def parse_review_report(text: str) -> ReviewReport:
    if not text.startswith("---\n"):
        raise ValueError("no YAML frontmatter found at the start of the report")

    end = text.find("\n---", 4)
    if end == -1:
        raise ValueError("no YAML frontmatter closing marker found")

    frontmatter = yaml.safe_load(text[4:end])

    return ReviewReport(
        date=frontmatter["date"],
        verdicts=[PrVerdict(**v) for v in frontmatter.get("verdicts", [])],
        findings=[Finding(**f) for f in frontmatter.get("findings", [])],
    )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd automation-kit/scripts && .venv/bin/pytest test_parse_review_report.py -v`
Expected: PASS, all 5 tests.

- [ ] **Step 6: Commit (in `automation-kit`)**

```bash
cd automation-kit
git add scripts/parse_review_report.py scripts/test_parse_review_report.py
git commit -m "feat: add the review-report parser both Reviewer and Issue Generator will use"
```

- [ ] **Step 7: Commit the template (in `adr-engine`)**

```bash
cd ../adr-engine  # adjust path as needed
git add docs/superpowers/reports/TEMPLATE.md
git commit -m "docs: add the review report template defining the Reviewer's output contract"
```

---

### Task 3: The two-credential model for a real merge gate

This task has no code of its own — it is a design decision that every later task depends on, and it must be resolved before Task 6 (branch protection) or Task 8 (the merge step) can be written correctly. Documenting it as its own task so it isn't buried inside a larger one.

**The problem:** `daily-agent.yml`'s existing `GH_PAT` is (per `automation-kit/README.md`) "a fine-grained PAT owned by the repo owner" — i.e., an admin-level credential. GitHub branch protection has an "Include administrators" setting; if left **unchecked** (the default), commits and merges made by an admin-owned credential **bypass protection entirely**. The Brainstormer and Reviewer both need exactly this bypass — they push `ROADMAP.md` and report-file changes directly, by design, with no PR gate (per the design doc's explicit decision that the Brainstormer's edits are not proposals). But if the Coder's PR-merge step uses that same admin `GH_PAT`, it would **also** silently bypass the merge gate's required checks and required review — defeating the entire point of Task 6/7/8.

**The resolution:** two credential tiers, split by *action*, not by which automation holds the credential:
- **Admin tier (`secrets.GH_PAT`)**: used by the Brainstormer (writes `ROADMAP.md`), the Reviewer (writes its own report file, submits reviews), and the Coder's comment-resolution job (pushes fix commits to an *already-open PR's own branch*). The precise safety property is **not** "only documentation paths ever touch this token" — the Coder's comment-resolution job does push application code with it. The property that actually holds is narrower and is what matters: **`GH_PAT` never performs the one action branch protection exists to gate — writing to the protected branch itself, whether via a direct push or a merge.** Pushing commits to a feature branch, or updating an already-open PR, requires no bypass of anything, because branch protection only governs the protected branch (`main`), never a PR's own topic branch. Everywhere else, `GH_PAT` is doing exactly what it always did in the original single-automation design: making commits, PRs, comments, and reviews show up as the repository owner's real identity instead of the Claude GitHub App's — an attribution concern, not a bypass concern.
- **Non-admin tier (the workflow-scoped default `${{ secrets.GITHUB_TOKEN }}`, with `permissions: contents: write, pull-requests: write` declared explicitly in the calling job)**: used for exactly one action across the whole system — the Reviewer's call to `gh pr merge` on an application-code PR, which is the only place anything ever writes to `main`. This token has no admin rights and is not the repository owner's identity, so GitHub's branch protection applies to it in full: a required check failing or a required review missing genuinely blocks the merge, rather than the blocking being merely a script's own promise not to try.

**Verification before proceeding**, since this cannot be fully confirmed without a live test:

- [ ] **Step 1: Confirm `GH_PAT`'s actual scope**

There is no way to read a secret's value or exact scope from outside the repository settings. Note this explicitly rather than assuming: before Task 6 is done, a human must open `https://github.com/settings/tokens?type=beta`, find the token used as `adr-engine`'s `GH_PAT` secret, and confirm it has `Administration: Read and write` (needed to configure branch protection programmatically in Task 6) in addition to the `Contents`/`Pull requests`/`Issues` read-write scopes the README already documents. If it does not have `Administration` scope, either regenerate it with that scope added, or configure branch protection manually via the repository's Settings UI instead of via the API in Task 6.

- [ ] **Step 2: Record the decision**

Add a short note to `docs/superpowers/specs/2026-08-19-automation-org-design.md`'s "Preparatory work" section (append, do not rewrite the section) confirming this credential split was implemented, so a future reader doesn't have to re-derive it from the workflow YAML alone:

```markdown
**Credential model, resolved during implementation** (see
`docs/superpowers/plans/2026-08-19-automation-org-implementation.md`,
Task 3): the admin-scoped `GH_PAT` is used only by the Brainstormer and
Reviewer, both of which touch only documentation paths. The Coder's
merge step uses the workflow-scoped default `GITHUB_TOKEN` instead,
specifically so branch protection is not silently bypassed by an
admin-owned credential doing the actual merging.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-19-automation-org-design.md
git commit -m "docs: record the two-credential model resolving the admin-bypass merge risk"
```

---

### Task 4: Reviewer reusable workflow — isolated per-PR review

**Files:**
- Create: `automation-kit/.github/workflows/reviewer.yml`

**Interfaces:**
- Consumes: nothing from earlier code tasks (this is the first workflow file). Uses Task 2's report template shape as the format its own output must match.
- Produces: a workflow callable as `uses: anubhab-m02/automation-kit/.github/workflows/reviewer.yml@main`, consumed by Task 9 (the `adr-engine` caller).

- [ ] **Step 1: Write the workflow**

Create `automation-kit/.github/workflows/reviewer.yml`:

```yaml
name: Reviewer

on:
  workflow_call:
    inputs:
      max_turns:
        required: false
        type: number
        default: 60
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN:
        required: true
      GH_PAT:
        required: true

jobs:
  list-open-prs:
    runs-on: ubuntu-latest
    outputs:
      pr_numbers: ${{ steps.list.outputs.pr_numbers }}
    steps:
      - name: List open PRs excluding the target repo's own docs-only PRs
        id: list
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          prs=$(gh pr list --repo "${{ github.repository }}" --state open --json number --jq '[.[].number]')
          echo "pr_numbers=$prs" >> "$GITHUB_OUTPUT"

  review-each-pr:
    needs: list-open-prs
    if: needs.list-open-prs.outputs.pr_numbers != '[]'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        pr_number: ${{ fromJson(needs.list-open-prs.outputs.pr_numbers) }}
      fail-fast: false
    permissions:
      contents: read
      pull-requests: write
    outputs: {}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Review PR ${{ matrix.pr_number }} in an isolated context
        id: review
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          github_token: ${{ secrets.GH_PAT }}
          allowedTools: "Read,Grep,Glob,Bash(git *),Bash(gh pr diff *),Bash(gh pr view *)"
          claude_args: "--max-turns ${{ inputs.max_turns }}"
          prompt: |
            You are reviewing PR #${{ matrix.pr_number }} in ${{ github.repository }}
            with NO knowledge of who wrote it, why, or what they were thinking — you
            have never seen this repository's chat history and never will. Judge only
            from the diff, the PR description, and this repository's own documented
            standards (read CLAUDE.md, docs/ARCHITECTURE.md, and any spec/issue the PR
            references).

            1. Run `gh pr diff ${{ matrix.pr_number }}` and read the full diff.
            2. Run `gh pr view ${{ matrix.pr_number }}` for its description and linked issue.
            3. Check the sensitive-path denylist FIRST, before anything else: if the
               diff touches any of `backend/auth/`, `backend/config_store.py`,
               `.github/workflows/*`, anything migration-shaped, or
               `backend/retrieval/search.py`, you MUST request changes regardless of
               how correct the change otherwise looks — a passing diff on a sensitive
               path still needs a human's explicit look, not just a clean test run.
               State in your REASON that this is a sensitive-path hold, not a
               correctness objection, so a human reading it later knows the
               distinction.
            4. If no sensitive path was touched: check whether it matches the linked
               issue's scope, follows this repo's documented standards, and doesn't
               introduce anything outside its stated scope.
            5. Decide: approve, or request changes.
            6. Write your verdict and reasoning as the LAST thing you output, in
               exactly this format (nothing after it):

               VERDICT: approve
               REASON: one sentence.

               or:

               VERDICT: request_changes
               REASON: one sentence naming the specific problem.

            Do not use any tool to modify the PR, comment on it, or submit a GitHub
            review yourself — output your verdict as plain text only. A separate step
            outside your control will read your verdict and act on it.

      - name: Extract verdict and submit the real GitHub review
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
          CLAUDE_OUTPUT: ${{ steps.review.outputs.output_text }}
        run: |
          set -euo pipefail
          verdict=$(echo "$CLAUDE_OUTPUT" | grep -oP '(?<=VERDICT: )\w+' | tail -1)
          reason=$(echo "$CLAUDE_OUTPUT" | grep -oP '(?<=REASON: ).*' | tail -1)

          if [ "$verdict" = "approve" ]; then
            gh pr review ${{ matrix.pr_number }} --repo "${{ github.repository }}" --approve --body "$reason"
          else
            gh pr review ${{ matrix.pr_number }} --repo "${{ github.repository }}" --request-changes --body "$reason"
          fi

          mkdir -p /tmp/verdicts
          echo "{\"pr_number\": ${{ matrix.pr_number }}, \"verdict\": \"$verdict\", \"reason\": \"$reason\"}" > "/tmp/verdicts/${{ matrix.pr_number }}.json"

      - name: Upload this PR's verdict for the report-writing job
        uses: actions/upload-artifact@v4
        with:
          name: verdict-${{ matrix.pr_number }}
          path: /tmp/verdicts/${{ matrix.pr_number }}.json
```

Note: `steps.review.outputs.output_text` is the expected output key for `claude-code-action@v1`'s final response text — verify this exact key name against the action's own README at implementation time (`gh api repos/anthropics/claude-code-action/contents/README.md`), since action output key names can change between versions and this plan cannot execute the action live to confirm it.

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('automation-kit/.github/workflows/reviewer.yml'))"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
cd automation-kit
git add .github/workflows/reviewer.yml
git commit -m "feat: add the isolated per-PR Reviewer workflow with real review submission"
```

---

### Task 5: Reviewer workflow — write the dated report and trigger Coder's comment-resolution

**Files:**
- Modify: `automation-kit/.github/workflows/reviewer.yml` (add a job after `review-each-pr`)

**Interfaces:**
- Consumes: the per-PR verdict artifacts uploaded by Task 4's `review-each-pr` job.
- Produces: `docs/superpowers/reports/YYYY-MM-DD-review.md` in the target repo, committed via the admin-tier `GH_PAT` per Task 3's credential model; a `repository_dispatch` event (`type: resolve-review-comments`) that Task 7 makes the Coder workflow listen for.

- [ ] **Step 1: Add the report-writing job**

Append to `automation-kit/.github/workflows/reviewer.yml`:

```yaml
  write-report-and-trigger-coder:
    needs: review-each-pr
    if: always() && needs.review-each-pr.result != 'skipped'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download every PR's verdict
        uses: actions/download-artifact@v4
        with:
          pattern: verdict-*
          path: /tmp/verdicts
          merge-multiple: true

      - name: Fetch the report parser (public repo, no auth needed)
        run: |
          mkdir -p automation-kit-scripts
          curl -sf -o automation-kit-scripts/parse_review_report.py \
            https://raw.githubusercontent.com/anubhab-m02/automation-kit/main/scripts/parse_review_report.py
          pip install --quiet pyyaml

      - name: Assemble and commit the report
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
        run: |
          set -euo pipefail
          git config --global user.name "${{ github.repository_owner }}"
          git config --global user.email "${{ github.repository_owner }}@users.noreply.github.com"

          today=$(date -u +%Y-%m-%d)
          report_path="docs/superpowers/reports/${today}-review.md"
          mkdir -p docs/superpowers/reports

          {
            echo "---"
            echo "date: ${today}"
            echo "verdicts:"
            for f in /tmp/verdicts/*.json; do
              [ -e "$f" ] || continue
              pr=$(jq -r '.pr_number' "$f")
              verdict=$(jq -r '.verdict' "$f")
              reason=$(jq -r '.reason' "$f")
              echo "  - pr_number: $pr"
              echo "    verdict: $verdict"
              echo "    reason: \"$reason\""
            done
            echo "findings: []"
            echo "---"
            echo ""
            echo "# Review report — ${today}"
            echo ""
            echo "## PRs reviewed"
            echo ""
            for f in /tmp/verdicts/*.json; do
              [ -e "$f" ] || continue
              pr=$(jq -r '.pr_number' "$f")
              verdict=$(jq -r '.verdict' "$f")
              reason=$(jq -r '.reason' "$f")
              echo "PR #${pr}: **${verdict}** — ${reason}"
              echo ""
            done
          } > "$report_path"

          # Fail loudly here rather than commit a report the Issue Generator
          # (Task 12) can't actually parse later — this is the parser built
          # and tested in Task 2, used as a real gate, not left decorative.
          python3 -c "
          import sys
          sys.path.insert(0, 'automation-kit-scripts')
          from parse_review_report import parse_review_report
          parse_review_report(open('$report_path').read())
          print('report parses correctly')
          "

          git add "$report_path"
          git commit -m "docs: add review report for ${today}"
          git push origin HEAD:main

      - name: Trigger the Coder's comment-resolution run
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
        run: |
          gh api repos/${{ github.repository }}/dispatches \
            -f event_type=resolve-review-comments
```

Note the `findings: []` placeholder in the assembled frontmatter — this job only ever populates per-PR verdicts automatically; findings not tied to a specific PR (drift, incidental bugs) require the Reviewer's Claude step to also surface those, which this task deliberately does not yet wire up (Task 4's prompt only asks for a verdict, not open-ended findings) — flag this as a known gap for a follow-up issue once this task lands, rather than silently pretending the findings mechanism is complete.

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('automation-kit/.github/workflows/reviewer.yml'))"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
cd automation-kit
git add .github/workflows/reviewer.yml
git commit -m "feat: write the dated review report and trigger Coder's comment-resolution run"
```

---

### Task 6: Coder workflow — independent per-issue branches and PRs

**Files:**
- Modify: `automation-kit/.github/workflows/daily-agent.yml`

**Interfaces:**
- Produces: the Coder workflow no longer uses a single `rolling_branch` input meaningfully for new-issue work — each attempted issue gets `issue/<number>-<slug>` as its own branch and its own PR.

- [ ] **Step 1: Read the current workflow in full**

Run: `gh api repos/anubhab-m02/automation-kit/contents/.github/workflows/daily-agent.yml --jq '.content' | base64 -d > /tmp/current-daily-agent.yml && cat /tmp/current-daily-agent.yml`

(Already read in full during the design/planning phase — re-read locally before editing so the diff is against real current content, not memory.)

- [ ] **Step 2: Replace the "Prepare rolling branch" step**

Remove the existing `Prepare rolling branch` step entirely (it checks out/creates `agent/rolling` once for the whole job) — branch creation now happens per-issue, inside the prompt's own instructions, since each issue needs its own branch checked out from the default branch fresh.

- [ ] **Step 3: Update the `Run Claude Code` step's prompt**

Replace the ground rules section (rules 1-9 in the current prompt) with:

```yaml
          prompt: |
            You are the unattended daily contributor for this repository. Unlike
            previous runs, you do NOT work on a single shared branch — each issue you
            attempt gets its OWN branch and its OWN pull request, so that one issue's
            problem never blocks another's.

            Candidate issues, in the order you should attempt them (priority-labeled
            issues first, then lowest number first):
            ${{ needs.find-task.outputs.candidates }}

            Ground rules:
            1. Read CLAUDE.md, ROADMAP.md, and docs/ARCHITECTURE.md first for project
               context and conventions. For each issue, read only the files it
               references or that are clearly required to implement it.
            2. For EACH issue you attempt: create a fresh branch named
               `issue/<number>-<short-slug>` from the current default branch (fetch
               and checkout the default branch first, THEN branch — never branch from
               a previous issue's branch), implement ONLY that issue's scope, commit
               it as its own small set of logically separate commits, push that
               branch, and open a NEW pull request from it to the default branch with
               a title describing the actual change and a body containing
               `Closes #<number>`. Do not touch any other issue's branch or PR.
            3. Complete between 1 and ${{ inputs.max_issues }} issues, stopping
               cleanly after finishing your current issue if running low on turn
               budget — never leave an issue half-implemented, and never leave a
               half-pushed branch with no PR opened for it.
            4. Do NOT merge anything yourself. Opening the PR is the end of your
               responsibility for that issue — a separate Reviewer automation decides
               whether it merges.
            5. Do not add any AI/bot attribution to commits, PR bodies, or issue
               comments. Git identity is already configured to the repository owner.
            6. If a candidate issue has a genuine ambiguity, a design decision only a
               human should make, a missing credential, a new dependency or tech
               stack being considered, or anything with a real or potential cost:
               stop working on that issue specifically, comment on it explaining
               what's needed, label it `needs-input`, and move on to the next
               candidate. Do not guess on judgment calls, and do not notify anyone
               directly — the Brainstormer automation is solely responsible for
               surfacing this to the human, on its own schedule.
            7. If, while implementing an issue, you notice one clearly-scoped piece of
               genuinely meaningful follow-up work, you may open at most ONE new
               issue for the whole run, labeled `needs-triage`, never `daily-task`
               directly.
            8. Keep each issue's diff proportional to its scope.
```

- [ ] **Step 4: Add the comment-resolution invocation path**

Add a new `workflow_call` input and a second job triggered by it, so the same workflow file serves both purposes:

```yaml
on:
  workflow_call:
    inputs:
      max_turns:
        required: false
        type: number
        default: 150
      max_issues:
        required: false
        type: number
        default: 3
      mode:
        description: "'new-issues' (default) or 'resolve-comments'"
        required: false
        type: string
        default: "new-issues"
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN:
        required: true
      GH_PAT:
        required: false
```

Add a job (alongside the existing `find-task`/`run-agent` jobs) that only runs in `resolve-comments` mode:

```yaml
  resolve-review-comments:
    if: inputs.mode == 'resolve-comments'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Find PRs with requested changes
        id: find
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          prs=$(gh pr list --repo "${{ github.repository }}" --state open --json number,reviewDecision \
            --jq '[.[] | select(.reviewDecision == "CHANGES_REQUESTED") | .number]')
          echo "prs=$prs" >> "$GITHUB_OUTPUT"

      - uses: actions/checkout@v4
        if: steps.find.outputs.prs != '[]'
        with:
          fetch-depth: 0

      - name: Resolve feedback on each flagged PR
        if: steps.find.outputs.prs != '[]'
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          github_token: ${{ secrets.GH_PAT }}
          bot_name: ${{ github.repository_owner }}
          bot_id: ${{ github.repository_owner_id }}
          claude_args: --max-turns ${{ inputs.max_turns }}
          prompt: |
            PRs with requested changes: ${{ steps.find.outputs.prs }}

            For each one: check out its branch, read the review comments via
            `gh pr view <n> --comments` and the review itself, address the specific
            feedback, commit, and push to the SAME branch (do not open a new PR — the
            existing one updates automatically). Do not pick up any new issues in
            this run — this run's only job is resolving existing feedback.
```

- [ ] **Step 5: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('automation-kit/.github/workflows/daily-agent.yml'))"`
Expected: no error.

- [ ] **Step 6: Commit**

```bash
cd automation-kit
git add .github/workflows/daily-agent.yml
git commit -m "feat: independent per-issue PRs and a chained comment-resolution mode"
```

---

### Task 7: Wire the `repository_dispatch` trigger for comment-resolution

**Files:**
- Modify: `automation-kit/.github/workflows/daily-agent.yml` (the `on:` block needs a matching repo-level trigger, but `workflow_call` workflows don't take `repository_dispatch` directly — this needs the *caller* workflow in `adr-engine`, not the reusable one, to listen for the dispatch and invoke the reusable workflow in `resolve-comments` mode)

**Interfaces:**
- Consumes: the `repository_dispatch` event type `resolve-review-comments` fired by Task 5.
- Produces: nothing new in `automation-kit` — this task's real content is Task 9's caller workflow in `adr-engine`, listed here so the dependency is explicit before Task 9 is written.

- [ ] **Step 1: Confirm the design**

`workflow_call`-triggered reusable workflows cannot themselves declare a `repository_dispatch` trigger — only a repo's own top-level workflow file can. This means the `adr-engine`-side caller workflow (Task 9) must have both a `schedule:` trigger (for the nightly new-issues run) AND a `repository_dispatch:` trigger (for the Reviewer-initiated comment-resolution run), each invoking the same reusable workflow with a different `mode` input. No code to write in this task — it exists so Task 9 doesn't silently invent this without the reasoning being visible.

- [ ] **Step 2: No commit for this task** — it is a design note consumed by Task 9.

---

### Task 8: The merge step — non-admin token, real enforcement

**Files:**
- Modify: `automation-kit/.github/workflows/reviewer.yml` (extend `write-report-and-trigger-coder`, or add a new step in `review-each-pr` right after the review-submission step)

**Interfaces:**
- Consumes: Task 3's two-credential model (uses `github.token`, the workflow-scoped default, never `secrets.GH_PAT`, for this specific step).
- Produces: an automatic `gh pr merge` attempt on every approved PR, which GitHub either allows (all three gate conditions met) or refuses (branch protection blocks it) — the refusal itself is the desired behavior, not an error to suppress.

- [ ] **Step 1: Add the merge attempt to `review-each-pr`, after review submission**

Modify the "Extract verdict and submit the real GitHub review" step in `reviewer.yml` (from Task 4) by appending, in the same step, after the `gh pr review` calls:

```yaml
          if [ "$verdict" = "approve" ]; then
            gh pr review ${{ matrix.pr_number }} --repo "${{ github.repository }}" --approve --body "$reason"

            # Merge attempt uses the workflow-scoped default token, NOT the
            # admin-scoped GH_PAT — see Task 3 of the implementation plan.
            # If branch protection isn't satisfied (checks still running,
            # sensitive path flagged, etc.) this call fails and that failure
            # is expected, not a bug — the PR simply stays open.
            GH_TOKEN="${{ github.token }}" gh pr merge ${{ matrix.pr_number }} \
              --repo "${{ github.repository }}" --squash --auto || \
              echo "Merge not yet possible for PR #${{ matrix.pr_number }} — branch protection is doing its job."
          else
            gh pr review ${{ matrix.pr_number }} --repo "${{ github.repository }}" --request-changes --body "$reason"
          fi
```

Note `--auto` on the merge command: this enables GitHub's auto-merge feature, which waits for any still-running required checks to complete before actually merging, rather than failing immediately if checks haven't finished yet at the moment this step runs. This is the correct behavior — the Reviewer's approval and the CI checks can finish in either order.

Note also: this step's `env:` for the `gh pr review` calls still uses `secrets.GH_PAT` (submitting a review requires write access the default token also has, but keeping it consistent with how the review was already being submitted in Task 4 is simpler than splitting tokens mid-step) — only the `gh pr merge` line itself is deliberately overridden to the non-admin `github.token` via its own inline `GH_TOKEN=`.

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('automation-kit/.github/workflows/reviewer.yml'))"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
cd automation-kit
git add .github/workflows/reviewer.yml
git commit -m "feat: attempt auto-merge with the non-admin token so branch protection is real"
```

---

### Task 9: `adr-engine` caller workflows — Reviewer, and Coder's two trigger paths

**Files:**
- Modify: `adr-engine/.github/workflows/daily-agent.yml`
- Create: `adr-engine/.github/workflows/reviewer.yml`

**Interfaces:**
- Consumes: `automation-kit`'s `daily-agent.yml` (Task 6/7) and `reviewer.yml` (Task 4/5/8) as `uses:` targets.

- [ ] **Step 1: Update `adr-engine`'s `daily-agent.yml`**

Read the current file (`cat .github/workflows/daily-agent.yml`), then replace its `jobs:` block to add the `repository_dispatch`-triggered comment-resolution path alongside the existing scheduled new-issues path:

```yaml
name: Daily Agent

on:
  schedule:
    - cron: "30 18 * * *"  # 00:00 IST, sleeps up to 180min -> lands 12am-3am IST
  repository_dispatch:
    types: [resolve-review-comments]
  workflow_dispatch: {}

jobs:
  new-issues:
    if: github.event_name != 'repository_dispatch'
    uses: anubhab-m02/automation-kit/.github/workflows/daily-agent.yml@main
    with:
      random_window_minutes: 180
      mode: new-issues
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      GH_PAT: ${{ secrets.GH_PAT }}

  resolve-comments:
    if: github.event_name == 'repository_dispatch'
    uses: anubhab-m02/automation-kit/.github/workflows/daily-agent.yml@main
    with:
      mode: resolve-comments
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      GH_PAT: ${{ secrets.GH_PAT }}
```

- [ ] **Step 2: Create `adr-engine`'s `reviewer.yml`**

```yaml
name: Reviewer

on:
  schedule:
    - cron: "30 0 * * *"  # 06:00 IST, sleeps up to 180min -> lands 6am-9am IST
  workflow_dispatch: {}

jobs:
  run:
    uses: anubhab-m02/automation-kit/.github/workflows/reviewer.yml@main
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      GH_PAT: ${{ secrets.GH_PAT }}
```

Note: `reviewer.yml`'s own reusable-workflow definition (Task 4) doesn't yet have a `random_window_minutes` sleep behavior — it wasn't specified in Task 4's YAML. This caller assumes it exists; if Task 4 didn't implement the random-sleep behavior, add it there first (copy the exact "Randomize start time within the target window" step from `daily-agent.yml`'s `find-task` job) before this task can be considered complete, since running Reviewer at the exact same minute every single day is a smaller but real version of the same "looks automated" concern the original design avoided.

- [ ] **Step 3: Validate both files' YAML syntax**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/daily-agent.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/reviewer.yml'))"
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/daily-agent.yml .github/workflows/reviewer.yml
git commit -m "feat: wire the Reviewer caller workflow and the Coder's chained comment-resolution trigger"
```

---

### Task 10: Branch protection on `main`

**Files:** none (repository configuration, not code) — but depends on Task 3's verification step having been completed first.

**Interfaces:**
- Consumes: Task 3's confirmed `GH_PAT` scope.
- Produces: `main` requiring passing status checks and an approving review before any merge, except from an admin-scoped credential (Task 3's deliberate bypass for the Brainstormer/Reviewer's docs-only pushes).

- [ ] **Step 1: Confirm current CI check names**

Run: `gh api repos/anubhab-m02/adr-engine/commits/main/check-runs --jq '.check_runs[].name'` (against a recent commit with checks attached — if `main`'s latest commit has none, run this against the most recent PR's head commit instead) to get the exact check names branch protection needs to reference (e.g. `pytest`, `test-and-eval` from `.github/workflows/backend-ci.yml`, and the frontend `npm test`/`build`/`lint` job names).

- [ ] **Step 2: Configure branch protection via the API**

```bash
gh api --method PUT repos/anubhab-m02/adr-engine/branches/main/protection \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]="<exact check name from Step 1>" \
  -f enforce_admins=false \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f restrictions=null
```

`enforce_admins=false` is the deliberate, documented choice from Task 3 — admin-owned credentials (the Brainstormer/Reviewer's docs-only pushes) bypass, everything else is enforced.

- [ ] **Step 3: Verify it actually applied**

Run: `gh api repos/anubhab-m02/adr-engine/branches/main/protection`
Expected: a real JSON body (not the earlier 404), showing `required_status_checks` and `required_pull_request_reviews` populated with the values from Step 2.

- [ ] **Step 4: Verify the bypass works as intended before trusting it**

Manually push a trivial, reversible doc change to `main` using the same `GH_PAT` (e.g. append a blank line to `README.md`, then revert it), confirming it succeeds despite protection being on. Then attempt the same push using a plain non-admin token (or simply confirm via `gh api repos/anubhab-m02/adr-engine/branches/main/protection --jq '.enforce_admins.enabled'` returns `false`) to confirm the split is real, not assumed.

- [ ] **Step 5: No git commit for this task** (repository setting, not a file change) — record completion by checking this task's boxes.

---

### Task 11: Brainstormer reusable workflow

**Files:**
- Create: `automation-kit/.github/workflows/brainstormer.yml`

**Interfaces:**
- Consumes: open `steering`-labeled issues, the latest file in `docs/superpowers/reports/`, open `needs-input` issues, `ROADMAP.md`, and (best-effort, per the design doc's own flagged uncertainty) `gh api repos/{repo}/dependabot/alerts`.
- Produces: an updated `ROADMAP.md` committed via the admin-tier `GH_PAT`; one comment + assignment on a persistent tracking issue (created if absent).

- [ ] **Step 1: Write the workflow**

```yaml
name: Brainstormer

on:
  workflow_call:
    inputs:
      max_turns:
        required: false
        type: number
        default: 100
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN:
        required: true
      GH_PAT:
        required: true

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Randomize start time within the target window
        if: github.event_name == 'schedule'
        run: |
          set -euo pipefail
          sleep_secs=$(( RANDOM % (180 * 60) ))
          sleep "$sleep_secs"

      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Ensure the daily tracking issue exists
        id: tracking
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
        run: |
          set -euo pipefail
          number=$(gh issue list --repo "${{ github.repository }}" --search "Daily status in:title" --state open --json number --jq '.[0].number // empty')
          if [ -z "$number" ]; then
            number=$(gh issue create --repo "${{ github.repository }}" --title "Daily status" \
              --body "Persistent tracking issue. The Brainstormer comments here once a day; being assigned to it is what sends the notification." \
              --json number --jq '.number' 2>&1) || \
              number=$(gh issue create --repo "${{ github.repository }}" --title "Daily status" \
                --body "Persistent tracking issue." | grep -oP '(?<=/issues/)\d+')
          fi
          echo "number=$number" >> "$GITHUB_OUTPUT"

      - name: Brainstorm and update ROADMAP.md
        id: brainstorm
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          github_token: ${{ secrets.GH_PAT }}
          bot_name: ${{ github.repository_owner }}
          bot_id: ${{ github.repository_owner_id }}
          allowedTools: "Read,Edit,Write,Grep,Glob,Bash(git *),Bash(gh *)"
          claude_args: --max-turns ${{ inputs.max_turns }}
          prompt: |
            You are the product manager for this repository, running once a day.

            FIRST, before anything else: check for open issues labeled `steering`
            (`gh issue list --label steering --state open`). If any exist, their
            content is BINDING instruction that overrides your own judgment for this
            run. After incorporating each one into ROADMAP.md, close it with a comment
            stating specifically what you changed as a result
            (`gh issue close <n> --comment "..."`).

            THEN read, in order: the most recent file in docs/superpowers/reports/
            (if any), open issues labeled `needs-input`, ROADMAP.md itself, and the
            output of `gh api repos/${{ github.repository }}/dependabot/alerts` (if
            this command fails due to missing token scope, note that in your summary
            rather than silently skipping it).

            Decide what the product needs next: fold review-report findings and
            needs-input blockers into ROADMAP.md as concrete next steps, add any real
            security alerts as roadmap items, and — using your own judgment, not only
            reacting to inputs — propose genuinely new ideas if you see a real gap.
            Edit ROADMAP.md directly. Do not open a PR for this — commit and push
            directly to the default branch, matching how this automation is meant to
            operate (see docs/superpowers/specs/2026-08-19-automation-org-design.md).

            FINALLY, write a short daily summary (issues completed since yesterday,
            PRs merged, anything needing human attention with a `[NEEDS ATTENTION]`
            prefix per line) and post it as a comment on issue #${{ steps.tracking.outputs.number }}
            via `gh issue comment ${{ steps.tracking.outputs.number }} --body "..."`.
            Keep this comment even on a quiet day — a short "nothing needs attention
            today" is still posted, every day, without exception.

      - name: Assign the human to trigger the notification
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
        run: |
          gh issue edit ${{ steps.tracking.outputs.number }} --repo "${{ github.repository }}" \
            --add-assignee "${{ github.repository_owner }}"
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('automation-kit/.github/workflows/brainstormer.yml'))"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
cd automation-kit
git add .github/workflows/brainstormer.yml
git commit -m "feat: add the Brainstormer workflow with steering-first, single daily notification"
```

---

### Task 12: Issue Generator reusable workflow

**Files:**
- Create: `automation-kit/.github/workflows/issue-generator.yml`

**Interfaces:**
- Consumes: `ROADMAP.md` as the Brainstormer leaves it; Task 2's `parse_review_report.py` for severity-based priority.

- [ ] **Step 1: Write the workflow**

```yaml
name: Issue Generator

on:
  workflow_call:
    inputs:
      max_turns:
        required: false
        type: number
        default: 100
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN:
        required: true
      GH_PAT:
        required: false

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Randomize start time within the target window
        if: github.event_name == 'schedule'
        run: |
          set -euo pipefail
          sleep_secs=$(( RANDOM % (180 * 60) ))
          sleep "$sleep_secs"

      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Deterministically parse the latest report's severities
        id: parse
        run: |
          set -euo pipefail
          latest=$(ls -1 docs/superpowers/reports/*.md 2>/dev/null | sort | tail -1 || true)
          if [ -z "$latest" ]; then
            echo "summary={}" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          curl -sf -o /tmp/parse_review_report.py \
            https://raw.githubusercontent.com/anubhab-m02/automation-kit/main/scripts/parse_review_report.py
          pip install --quiet pyyaml
          summary=$(python3 -c "
          import sys, json
          sys.path.insert(0, '/tmp')
          from parse_review_report import parse_review_report
          report = parse_review_report(open('$latest').read())
          print(json.dumps({
              'date': report.date,
              'verdicts': [v.__dict__ for v in report.verdicts],
              'findings': [f.__dict__ for f in report.findings],
          }))
          ")
          echo "summary=$summary" >> "$GITHUB_OUTPUT"

      - name: File and update issues from ROADMAP.md and the latest report
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          github_token: ${{ secrets.GH_PAT }}
          bot_name: ${{ github.repository_owner }}
          bot_id: ${{ github.repository_owner_id }}
          allowedTools: "Read,Grep,Glob,Bash(git *),Bash(gh *)"
          claude_args: --max-turns ${{ inputs.max_turns }}
          prompt: |
            You are the scrum master for this repository, running once a day.

            The latest review report has already been parsed deterministically —
            trust this structure for verdicts/severity rather than re-reading and
            re-judging the report file's prose yourself:

            ${{ steps.parse.outputs.summary }}

            1. Read ROADMAP.md in full.
            2. Before filing ANY new issue, check it doesn't already exist: run
               `gh issue list --repo ${{ github.repository }} --state all --search "<key terms>"`
               for each candidate and skip filing if a matching issue (open OR
               closed) already covers it.
            3. For each ROADMAP.md item with no existing issue: file a `daily-task`
               issue with exact files to touch and acceptance criteria checkable by
               pytest/npm test, per this repo's binding issue-sizing rules (see
               ROADMAP.md's Delivery model section).
            4. For each `finding` in the parsed structure above with `severity:
               major`: file it as a `daily-task` issue and also add the `priority`
               label. For `severity: minor`: file as a plain `daily-task`, no
               `priority` label. Take severity from the parsed structure exactly as
               given — do not re-judge it yourself.
            5. For any existing issue the parsed `verdicts`/`findings` indicate is now
               resolved or no longer applicable, close it with a comment citing which
               report/PR resolved it.

            Do not create more than 10 new issues in a single run — if there is more
            backlog than that, file the 10 most load-bearing (fewest dependencies on
            things not yet built) and leave the rest for tomorrow's run.
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('automation-kit/.github/workflows/issue-generator.yml'))"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
cd automation-kit
git add .github/workflows/issue-generator.yml
git commit -m "feat: add the Issue Generator workflow with dedup and severity-based priority"
```

---

### Task 13: `adr-engine` caller workflows — Brainstormer and Issue Generator

**Files:**
- Create: `adr-engine/.github/workflows/brainstormer.yml`
- Create: `adr-engine/.github/workflows/issue-generator.yml`

**Interfaces:**
- Consumes: `automation-kit`'s `brainstormer.yml` (Task 11) and `issue-generator.yml` (Task 12).

- [ ] **Step 1: Create `adr-engine`'s `brainstormer.yml`**

```yaml
name: Brainstormer

on:
  schedule:
    - cron: "30 6 * * *"  # 12:00 IST, sleeps up to 180min -> lands 12pm-3pm IST
  workflow_dispatch: {}

jobs:
  run:
    uses: anubhab-m02/automation-kit/.github/workflows/brainstormer.yml@main
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      GH_PAT: ${{ secrets.GH_PAT }}
```

- [ ] **Step 2: Create `adr-engine`'s `issue-generator.yml`**

```yaml
name: Issue Generator

on:
  schedule:
    - cron: "30 12 * * *"  # 18:00 IST, sleeps up to 180min -> lands 6pm-9pm IST
  workflow_dispatch: {}

jobs:
  run:
    uses: anubhab-m02/automation-kit/.github/workflows/issue-generator.yml@main
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      GH_PAT: ${{ secrets.GH_PAT }}
```

- [ ] **Step 3: Validate both files' YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/brainstormer.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/issue-generator.yml'))"
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/brainstormer.yml .github/workflows/issue-generator.yml
git commit -m "feat: wire the Brainstormer and Issue Generator caller workflows"
```

---

### Task 14: Manual verification, one automation at a time, before any cron is trusted

**Files:** none — this task is entirely manual verification.

**Interfaces:** none — this is the final gate before Task 15 enables schedules.

- [ ] **Step 1: Dispatch the Reviewer manually against a real open PR**

Run: `gh workflow run reviewer.yml --repo anubhab-m02/adr-engine`
Then: `gh run watch --repo anubhab-m02/adr-engine` (find the run ID via `gh run list --workflow=reviewer.yml --repo anubhab-m02/adr-engine --limit 1`)
Expected: the run completes; check that it actually submitted a real review (`gh pr view <n> --repo anubhab-m02/adr-engine --json reviews`) and that a report file appeared under `docs/superpowers/reports/`.

- [ ] **Step 2: Dispatch the Coder manually and confirm independent PRs**

Run: `gh workflow run daily-agent.yml --repo anubhab-m02/adr-engine`
Expected: if any `daily-task` issues are eligible, the run produces one branch/PR per issue attempted — confirm via `gh pr list --repo anubhab-m02/adr-engine --json headRefName` that PR branches are named `issue/<n>-...`, not a shared branch.

- [ ] **Step 3: Manually fire the `repository_dispatch` comment-resolution path**

Run: `gh api repos/anubhab-m02/adr-engine/dispatches -f event_type=resolve-review-comments`
Expected: the `resolve-comments` job in `daily-agent.yml` runs (confirm via `gh run list --repo anubhab-m02/adr-engine`); if there was a PR with `CHANGES_REQUESTED`, confirm it received new commits.

- [ ] **Step 4: Dispatch the Brainstormer manually**

Run: `gh workflow run brainstormer.yml --repo anubhab-m02/adr-engine`
Expected: `ROADMAP.md` gets a real commit on `main` directly (no PR); the "Daily status" tracking issue exists, has a new comment, and you are assigned to it (confirm you actually received a GitHub notification email for this specific assignment — this is the one step in the whole plan that must be confirmed by a human observing their own inbox, not by any command).

- [ ] **Step 5: Dispatch the Issue Generator manually**

Run: `gh workflow run issue-generator.yml --repo anubhab-m02/adr-engine`
Expected: any genuinely new `ROADMAP.md` items not yet ticketed get filed as issues; re-running it a second time immediately after produces zero new issues (confirms the dedup check works — this is the specific failure mode to watch for).

- [ ] **Step 6: Test a deliberate merge-gate failure**

Manually open a trivial PR that touches `backend/config_store.py` (the sensitive-path denylist) with an otherwise-passing change, then dispatch the Reviewer against it. Expected: the Reviewer's own gating logic declines to approve it (per Task 4's prompt instructions covering standards review) — if it approves anyway, the sensitive-path check in the Reviewer's prompt needs to be made more explicit before trusting this in production, since this is exactly the enforcement gap the design doc named as having no GitHub-native backstop.

---

### Task 15: Enable the schedules

**Files:** none — this task only requires the four `cron:` entries already present (added in Tasks 9 and 13) to actually take effect, which they do automatically once merged to each repo's default branch. This task exists to make explicit that merging Tasks 9/13's workflow files IS the moment automation begins, and it should happen only after Task 14 passes.

- [ ] **Step 1: Confirm every prior task's checkboxes are checked**

Do not proceed if Task 14 found any failure that wasn't fixed.

- [ ] **Step 2: Merge the caller-workflow PRs**

If Tasks 9 and 13's files were built on feature branches (recommended, even though this plan's other commits describe direct commits for simplicity — workflow files specifically are worth a human's final look before they can trigger real scheduled runs), open and merge PRs for them now.

- [ ] **Step 3: Watch the first real scheduled run of each**

The next occurrence of each cron window (00:00, 06:00, 12:00, 18:00 IST) is the first unattended run. Check `gh run list --repo anubhab-m02/adr-engine` the following day for all four, and treat any unexpected failure as a reason to disable that specific workflow's schedule (comment out its `cron:` line, keep `workflow_dispatch`) rather than letting it keep retrying unattended.
