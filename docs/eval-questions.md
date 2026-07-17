# Golden evaluation questions

Per [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md#evaluation-lightweight-phase-1),
this is the manual quality gate: no automated eval harness exists in
Phase 1. Once both repos are indexed (`POST /ingest`), run each question
below through `POST /query` (or the UI once it exists) and compare the
returned citations to the "expected source" column. A regression is any
question whose citation set stops matching after a retrieval or
extraction change — note it here or in the PR that caused it.

Sources are drawn from real commit history in
[anubhab-m02/BuFin](https://github.com/anubhab-m02/BuFin) (the sibling
project this engine is built to query) and from adr-engine's own PR
history. Commit SHAs are shown short (8 chars); the full SHA resolves on
GitHub.

## BuFin questions

| # | Question | Expected source | Why |
|---|---|---|---|
| 1 | Why does the AI task router try Ollama before Gemini for lightweight tasks? | `anubhab-m02/BuFin` commit [`469a45f3`](https://github.com/anubhab-m02/BuFin/commit/469a45f3d9df021bb20d40e5a3eb6be473639666) | "route lightweight AI tasks to local Ollama model, upgrade reasoning calls to Gemini 3 Flash" — a deliberate cost/latency split between local and cloud models. |
| 2 | Why do debt-repayment transactions carry a link back to the debt they repay? | `anubhab-m02/BuFin` commit [`2e768a70`](https://github.com/anubhab-m02/BuFin/commit/2e768a708cb5892fa8918ccd79673c90490232c9) | "link debt-repayment transactions to their debt so deleting the transaction reverts debt status" — without the link, deleting a repayment can't undo its effect on the debt. |
| 3 | Why was `migrate_db.py` replaced with Alembic? | `anubhab-m02/BuFin` commit [`bdad01bc`](https://github.com/anubhab-m02/BuFin/commit/bdad01bc73df4082b03234f92fea331a1128b303) | "pin backend deps, migrate to Pydantic v2 syntax, add Alembic migrations" — moved schema migrations off a hand-rolled script onto a standard tool. |
| 4 | Why does the transaction classifier parse JSON with a balanced bracket parser instead of a regex? | `anubhab-m02/BuFin` commit [`6a738c85`](https://github.com/anubhab-m02/BuFin/commit/6a738c8561162d6d2835b0d7036d77cc4101b7ed) | "replace greedy JSON regex with balanced bracket parser in transaction classifier" — a greedy regex over-matched on nested/adjacent JSON. |
| 5 | Why does subscription detection require a minimum time gap between charges? | `anubhab-m02/BuFin` commit [`0fbc9b7a`](https://github.com/anubhab-m02/BuFin/commit/0fbc9b7ae23197a5a80558be65a2bcccf1b8f10a) | "require min time gap for subscription detection and use proportional leak-detection floor" — guards against same-day duplicate charges being mistaken for a recurring subscription. |
| 6 | Why are achievements based on distinct-day activity instead of point-in-time totals? | `anubhab-m02/BuFin` commit [`fd15b085`](https://github.com/anubhab-m02/BuFin/commit/fd15b0855ccea84ae50326abcbdd4e67a5517ea2) | "base achievements on distinct-day activity instead of point-in-time totals to prevent gaming" — a point-in-time total could be gamed by repeated same-moment actions. |
| 7 | Why does `repayDebt` guard against duplicate repayment transactions? | `anubhab-m02/BuFin` commit [`f4301801`](https://github.com/anubhab-m02/BuFin/commit/f4301801e94b7c94e4237e3f6a9d111a3e92407e) | "guard repayDebt against duplicate repayment transactions from double-clicks/retries" — a double-click or client retry could otherwise record the same repayment twice. |
| 8 | Why was the last-working-day date resolution logic extracted into a shared util? | `anubhab-m02/BuFin` commit [`01025d97`](https://github.com/anubhab-m02/BuFin/commit/01025d9798e92b3ab56d3acf07e87de0883a05f3) | "extract duplicated last-working-day date resolution into shared utils.resolveExpectedDay" — the same weekend-skipping logic had drifted into multiple call sites. |
| 9 | Why does the backend spending alert use the frontend's local date instead of computing its own? | `anubhab-m02/BuFin` commit [`5d18ce7d`](https://github.com/anubhab-m02/BuFin/commit/5d18ce7dac28a88673be202c43c4715ee1c605c8) | "use frontend local date as source of truth for backend spending alert to avoid timezone divergence" — the backend's server timezone could disagree with the user's local day boundary. |
| 10 | Why was the "average BuFin user" benchmark in insights replaced? | `anubhab-m02/BuFin` commit [`49eb2e75`](https://github.com/anubhab-m02/BuFin/commit/49eb2e7516cd014b65280805fe9da3f56441161e) | "replace fabricated 'average BuFin user' benchmark with user's own historical average" — the cross-user benchmark wasn't backed by real data. |

## adr-engine questions

adr-engine's own history is thin so far — work has landed as a handful of
batched rolling PRs (see `gh pr list --state merged`) rather than one
decision per PR, so citations here resolve at PR granularity rather than
a single tightly-scoped commit. Revisit this section as more PRs land
after the rolling PR model has been running longer.

| # | Question | Expected source | Why |
|---|---|---|---|
| 11 | Why does retrieval drop results below a similarity floor instead of always returning the top k? | `anubhab-m02/adr-engine` PR [#47](https://github.com/anubhab-m02/adr-engine/pull/47) | Per SYSTEM-DESIGN.md: a low-relevance result forced into the top-k would get cited by synthesis anyway, risking a confidently-wrong answer instead of an honest "not found." |
| 12 | Why does ingestion abort the whole run if Ollama is unreachable, instead of skipping and continuing? | `anubhab-m02/adr-engine` PR [#46](https://github.com/anubhab-m02/adr-engine/pull/46) | Per ARCHITECTURE.md's error-handling conventions: ingestion is per-item fault-tolerant but per-run fail-loud — Ollama being down isn't a bad item, it's an environment problem that would silently skip everything. |
