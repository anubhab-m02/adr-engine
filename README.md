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

## Quickstart

### Prerequisites

- Python 3.12+
- Node 22+
- [Ollama](https://ollama.com) running locally, with the two models used
  by indexing pulled:
  ```
  ollama pull nomic-embed-text
  ollama pull phi4-mini
  ```
  (`phi4-mini` is the default extraction model; if you set a different
  `OLLAMA_EXTRACTION_MODEL`, pull that one instead.)
- A GitHub token with `repo:read` access to whatever repos you want to
  index
- A [Gemini API key](https://ai.google.dev/) (synthesis only — retrieved
  snippets are sent, never the full corpus)

### Backend

```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
```

Fill in `backend/.env`: `GITHUB_TOKEN`, `INDEXED_REPOS` (comma-separated
`owner/repo` list), and `GEMINI_API_KEY`. Then:

```
uvicorn main:app --reload
```

Confirm it's up with `curl http://localhost:8000/health`.

### Frontend

In a second terminal:

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

`frontend/.env`'s `VITE_API_BASE_URL` already points at
`http://localhost:8000` to match the backend above. Open the URL Vite
prints (defaults to `http://localhost:5173`).

### First ingestion

Index every repo listed in `INDEXED_REPOS`:

```
curl -X POST http://localhost:8000/ingest
```

This fetches commits/PRs, extracts decision units, and stores them in
Chroma — the response reports `fetched`/`extracted`/`skipped`/`stored`
counts per repo. It can take a while on a repo's first run.

### First question

In the browser tab from the frontend step, click one of the example
chips (or type your own question about the repos you indexed) and
submit. You should get a cited answer with citation cards linking back
to the source commit/PR — or a calm "nothing in the indexed history
covers this" message if nothing relevant was indexed yet.

## Status

Early scaffold — see open issues labeled `daily-task` for in-flight work.

## Automation

This repo is wired to [automation-kit](https://github.com/anubhab-m02/automation-kit)'s
daily-agent workflow: a scheduled job picks up the oldest open `daily-task`
issue each day, implements it, and opens a PR for review. See that repo's
README for the design and guardrails.
