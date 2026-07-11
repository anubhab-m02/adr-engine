# adr-engine — Project Notes for Claude

"Why Did We Build It This Way?" engine — RAG over a team's commit/PR/ticket
history so decisions stay queryable instead of archaeological. See
[ROADMAP.md](ROADMAP.md) for scope and phasing.

## Stack

- Backend: FastAPI (Python)
- Vector store: Chroma, local/file-based
- Embeddings: local Ollama (`nomic-embed-text`) — indexing never leaves
  the machine
- Extraction (raw commit/PR → structured decision unit): local Ollama,
  cheap templated task
- Synthesis (retrieved units → cited answer): cloud model (Gemini/Claude)
  — only the retrieved top-k units are sent, never the full corpus
- Frontend: React

This hybrid split (local for indexing/extraction, cloud only for final
synthesis) is deliberate — commit/PR content can be sensitive, so it's
processed locally wherever the task is templated enough for a local model
to handle well, and only sent to a cloud model for the parts that need
stronger reasoning.

## Running locally

- Backend: `cd backend && uvicorn main:app --reload`
- Frontend: `npm run dev`
- Requires Ollama running locally with `nomic-embed-text` and an
  extraction-capable model pulled.

## Conventions for the daily agent

- One `daily-task` issue per PR. Don't expand scope mid-issue.
- Ingestion and extraction logic should be idempotent — re-running on
  already-indexed commits/PRs must not duplicate entries in Chroma.
- Citations are load-bearing: any synthesis-endpoint change must preserve
  the ability to trace an answer back to a specific commit/PR URL.
- No test suite exists yet — for money-math-equivalent logic here (i.e.
  the extraction/citation pipeline), verify by reading the code path end
  to end and, where practical, add tests as part of the issue rather than
  assuming manual verification is enough.
