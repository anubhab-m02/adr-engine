# Roadmap — adr-engine

> "Context drives intent, which manifests as code. If over time, code is
> the only remaining archaeological artefact, we are simply left with
> effect without knowing the cause."

RAG applied to a team's *living decision history*, not static documents.
Ask "why is auth done this way?" or "what alternatives did we consider for
the database?" and get a cited answer pointing back to the commit, PR, or
ticket where that decision actually happened.

## Phase 1 — MVP: GitHub only (current focus)

Ingest commits + PR titles/descriptions/review comments from a configured
list of repos, extract the decision intent behind them, and make that
queryable with citations.

Pipeline:
1. **Ingest** — GitHub API pulls commits + PRs (+ linked issues) for
   configured repos, incrementally since the last run.
2. **Extract** — local Ollama pass per commit/PR condenses the raw
   diff/description into a structured "decision unit": what was decided,
   why, what alternatives were mentioned (if any).
3. **Embed** — local Ollama (`nomic-embed-text`) embeds each decision
   unit. Nothing leaves the machine at index time.
4. **Store** — Chroma (local, file-based), with metadata: repo, commit
   SHA / PR number, author, date, URL.
5. **Query** — FastAPI endpoint retrieves top-k decision units, sends only
   those (not the whole corpus) to a cloud model (Gemini/Claude) for
   synthesis, returns an answer with inline citations back to GitHub.
6. **Frontend** — React chat-style UI: ask a question, get an answer with
   clickable citation cards (commit/PR links, author, date).

Deliberately out of scope for Phase 1: Jira, Slack, multi-tenant/hosted
deployment, auth.

## Phase 2 — Jira

Pull ticket descriptions + comments, link them to commits/PRs via branch
name or PR body references. Same extract → embed → store pipeline, tagged
with `source: jira`.

## Phase 3 — Slack (optional, privacy-sensitive)

Explicit opt-in per channel, not blanket workspace ingestion. Needs its
own scoping pass before backlog issues get written for it.

## Non-goals (for now)

- Hosted/multi-user product — this is a personal tool over your own repos
  first.
- Real-time ingestion — daily/on-demand batch is fine.
- Fine-tuning — retrieval + citation quality first, model tuning never (use
  better retrieval and prompting before reaching for fine-tuning).
