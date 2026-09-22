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
