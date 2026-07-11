# adr-engine

**"Why Did We Build It This Way?"** — RAG elevated to organizational
memory.

Writing ADRs suffers from misaligned incentives: the cost of documenting a
decision is paid immediately, the benefit is reaped by whoever reads it
months later. Adoption is inconsistent as a result. This project skips the
"please remember to write it down" step and instead mines the decision
intent that's already implicit in commits, PRs, and (later) tickets —
making it queryable:

- "Why is authentication done this way?"
- "What alternatives did we consider for the database?"
- "Who made the decision to use Redis, and when?"

Every answer is cited back to the exact commit or PR it came from.

See [ROADMAP.md](ROADMAP.md) for current scope and [CLAUDE.md](CLAUDE.md)
for architecture/stack notes.

## Status

Early scaffold — see open issues labeled `daily-task` for in-flight work.

## Automation

This repo is wired to [automation-kit](https://github.com/anubhab-m02/automation-kit)'s
daily-agent workflow: a scheduled job picks up the oldest open `daily-task`
issue each day, implements it, and opens a PR for review. See that repo's
README for the design and guardrails.
