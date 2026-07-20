# UI Design — adr-engine (Phase 2: productization)

Engineering handoff spec for the Phase 2 redesign. Binding for the daily
agent, per ARCHITECTURE.md. Supersedes the Phase 1 single-page spec.
Strategic context: [../PRODUCT.md](../PRODUCT.md). Scope and phasing:
[../ROADMAP.md](../ROADMAP.md).

The product becomes four surfaces in an app shell — **Onboarding** (gates
first run), **Ask** (the reading room, primary), **Library** (repos &
indexing), **Settings** — with an editorial/archival identity: quiet
chrome, a serif reading surface, citations treated as first-class
typography. Anchors: Readwise Reader's reading calm, Are.na's archival
restraint, Linear's interaction crispness. Anti-references: terminal-dark
dev-tool clichés, stock chat-template look, SaaS dashboard grammar.

## Design tokens

Defined in `frontend/src/index.css` (`@theme` + dark override at `:root`
under `@media (prefers-color-scheme: dark)` — the existing mechanism is
unchanged; components never use `dark:` classes). All colors OKLCH.
Values below are the committed starting points; **every issue that
applies them must verify ≥4.5:1 body / ≥3:1 large-text contrast** (AA)
and may nudge L to pass, keeping hue/chroma.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-surface` | `oklch(0.985 0.004 70)` | `oklch(0.185 0.008 70)` | page background |
| `--color-panel` | `oklch(1 0 0)` | `oklch(0.23 0.01 70)` | cards, bars, inputs |
| `--color-ink` | `oklch(0.24 0.01 70)` | `oklch(0.93 0.005 70)` | primary text |
| `--color-ink-muted` | `oklch(0.47 0.015 70)` | `oklch(0.70 0.015 70)` | metadata, secondary |
| `--color-accent` | `oklch(0.52 0.11 60)` | `oklch(0.75 0.10 65)` | actions, selection, focus, citation markers |
| `--color-accent-ink` | `oklch(0.99 0.005 70)` | `oklch(0.17 0.02 65)` | text on accent fills |
| `--color-highlight` | accent at 12% alpha | accent at 16% alpha | linked-source hover wash, marks |
| `--color-danger` | `oklch(0.50 0.19 27)` | `oklch(0.70 0.17 25)` | errors only |

The bronze accent replaces stock indigo everywhere. `--color-highlight`
is derived (`color-mix(in oklch, var(--color-accent) 12%, transparent)`),
not hand-picked per theme.

### Typography

| Token | Stack | Use |
|---|---|---|
| `--font-reading` | `"Source Serif 4", Georgia, serif` (bundled via `@fontsource-variable/source-serif-4`; no CDN — local-first) | answer prose, onboarding display lines, empty-state prompts |
| `--font-ui` | `system-ui, -apple-system, "Segoe UI", sans-serif` | all chrome: nav, buttons, forms, labels, cards |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, monospace` | SHAs, `owner/repo` names, device codes — only where content is code-like |

Fixed rem scale (no fluid type): `text-sm` 0.875 / `text-base` 1 /
`text-lg` 1.125 semibold (section heads) / `text-2xl` 1.5 (onboarding
display, `--font-reading`). Reading prose: `--font-reading` at
1.0625rem, line-height 1.7, `max-width: 70ch`. Chrome stays `--font-ui`;
never display type in buttons/labels.

### Spacing, radius, elevation

Tailwind scale only. Cards `rounded-xl`, controls `rounded-lg`. Card
padding `p-4`; section gaps `gap-4`; page gutters `px-4` (mobile) /
`px-6` (≥640px). One shadow level for floating elements (dropdown,
toast): `shadow-md`; flat panels otherwise. Z-scale (semantic, no
arbitrary values): `--z-dropdown: 10`, `--z-sticky: 20`, `--z-toast: 30`.

### Motion

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--dur-state` | `150ms` (hover, focus, toggles) |
| `--dur-surface` | `220ms` (panels, route transitions, cards entering) |

Motion conveys state only — no page-load choreography. **One** signature
moment (Ask § below). Every animation ships its
`@media (prefers-reduced-motion: reduce)` alternative: crossfade ≤150ms
or instant.

## App shell

New files: `frontend/src/shell/AppShell.jsx`, `TopNav.jsx`,
`StatusPill.jsx`. Routing via `react-router-dom` (new dependency —
ARCHITECTURE.md's "no router" rule is superseded in Phase 2): `/`
(Ask), `/library`, `/settings`, `/onboarding`. `GET /setup/state`
decides the gate: incomplete setup redirects everything to
`/onboarding`; complete setup redirects `/onboarding` away.

Layout: slim top bar, `h-14`, `bg-panel`, full-width; content area
`max-w-5xl mx-auto`. Left: wordmark (`--font-reading`, 1.125rem,
semibold — the one serif element in chrome, as brand signature). Center:
nothing. Right: nav links Ask · Library · Settings (`--font-ui` text-sm;
active = `--color-accent` text + 2px underline offset 6px; inactive =
`--color-ink-muted`, hover → `--color-ink`) and StatusPill.

**StatusPill** — visible only while `GET /ingest/status` reports an
active job. `rounded-lg bg-highlight text-accent text-sm px-3 py-1`,
content: pulsing 6px dot + `Indexing owner/repo…` (repo currently in
progress; if >1 queued: `Indexing 2 repos…`). Click → `/library`. On
job completion: pill swaps to `✓ Indexed` for 4s, then fades out
(`--dur-surface`); on failure: danger dot + `Indexing failed`, persists
until visited. A11y: `role="status"`, `aria-live="polite"`.

Responsive: <640px nav collapses to icons with `aria-label`s
(Ask=quill, Library=archive-box, Settings=gear; inline SVG, 20px,
`stroke-current`), StatusPill collapses to its dot. No hamburger.

## Onboarding (`/onboarding`)

Full-screen flow, no app shell. Three steps + optional key step; state
machine driven by `GET /setup/state`, resumable (refresh returns to the
furthest incomplete step). Progress: three quiet dots top-center
(`--color-ink-muted`; current = `--color-accent`), not a numbered
stepper. Files: `frontend/src/onboarding/OnboardingPage.jsx`,
`ConnectStep.jsx`, `DeviceCodeCard.jsx`, `RepoPickerStep.jsx`,
`RepoPickerRow.jsx`, `IndexStep.jsx`, `GeminiKeyStep.jsx`.

### Step 1 — Welcome + Connect (the one Committed-color surface)

Full-bleed `--color-accent` background, `--color-accent-ink` text.
Wordmark large in `--font-reading` (text-2xl), one line of purpose copy
("Ask your codebase why. Answers cited to the commit where it was
decided — your code never leaves this machine."), one button: **Connect
GitHub** (`bg-panel text-ink` — inverted on the accent surface).

Click → `POST /auth/github/device/start` → **DeviceCodeCard**: the
`user_code` in `--font-mono` text-2xl, letter-spaced, with a Copy
button (`aria-label="Copy code"`; on copy: label → "Copied" 2s); link
"Open github.com/login/device" (opens new tab, the only external link);
caption "Waiting for approval…" with pulsing dot while the app polls
`GET /auth/github/status` at the server-provided interval.

| State | Behavior |
|---|---|
| pending | card as described, poll continues |
| authorized | card swaps to `✓ Connected as {login}` (300ms crossfade), auto-advance to Step 2 after 800ms |
| expired | code area greys, caption "Code expired." + **Get a new code** button (restarts flow) |
| denied | caption in `--color-danger`: "Authorization was denied." + retry button |
| network error | ErrorCard pattern inline, retry re-calls start |

### Step 2 — Choose repos

Panel card, `max-w-xl` centered, on plain `--color-surface` (Committed
moment is over). Heading (`--font-reading` text-lg): "Which repos should
adr-engine read?" Search input filters `GET /github/repos?query=`
(debounced 300ms). List: **RepoPickerRow** = checkbox + `owner/name`
(`--font-mono` text-sm) + private-lock icon when private + right-aligned
size hint (`--color-ink-muted` text-sm: "~1.2k commits · est. 8 min" —
from the API's commit-count estimate; omit when unknown). Privacy line
pinned under the heading (`text-sm text-ink-muted`): "Extraction runs on
your local Ollama — repo contents never leave this machine."

States: loading = 5 skeleton rows (`animate-pulse bg-highlight`
rounded-lg h-9); empty search = "No repos match."; API error = inline
ErrorCard + retry; org-restricted = footnote linking GitHub's org-access
settings page. Continue button disabled until ≥1 selected; label
"Index N repo(s)". Click → `POST /ingest {repos}` → Step 3.

### Step 3 — Indexing

Reuses **IndexProgress** (Library § below) as its body — same component,
same poll. Heading: "Reading your history." Sub-line rotates honest
per-phase copy from status (§ Library). The moment the **first repo
completes**, a **Start asking** button appears (accent fill) — indexing
continues in background; remaining repos keep progressing (StatusPill
takes over after leaving). "Some failed" shows per-repo retry but never
blocks Start asking if ≥1 repo succeeded.

### Optional — Gemini key (inline card below Step 3 progress)

Quiet panel: "Add a Gemini key to get synthesized answers (optional)" +
masked input + Save + **Skip for now** link. Copy under input: "Only the
retrieved snippets you ask about are ever sent to Gemini." Save →
`PATCH /config` with live validation (§ Settings states). Skipping sets
nothing; Ask runs in sources-only mode.

## Ask (`/`) — the reading room

The Phase 1 chat becomes an editorial surface. Files: existing
components move to `frontend/src/ask/` (`AskPage.jsx` owns state —
extracted from `App.jsx`, which shrinks to shell+router):
`AnswerPassage.jsx` (replaces `AnswerCard`), `CitationMarker.jsx`,
`SourceCard.jsx` (evolved `CitationCard`), `SourcesView.jsx` (degraded
mode), restyled `ChatInput` / `MessageList` / `LoadingCard` /
`ErrorCard` in place.

Layout unchanged in skeleton (scrolling thread, `max-w-3xl` centered,
sticky bottom input on `bg-panel`) — the redesign is in the pieces:

- **User question**: compact bubble, right-aligned, `bg-highlight
  text-ink` (no more solid accent slab), `rounded-xl p-3`, text-sm.
- **AnswerPassage**: no card chrome — prose set directly on surface.
  `--font-reading`, 1.0625rem/1.7, `max-width: 70ch`. Inline
  **CitationMarker**s: superscript `¹ ²` in `--color-accent`,
  `--font-ui` text-xs, `cursor-pointer`, rendered from `[unit-id]`
  citations in the answer text (parse order of first appearance → 1..n).
  Hover/focus on a marker → linked SourceCard gets `--color-highlight`
  wash (`--dur-state`); click → card scrolls into view + 1.2s wash.
- **Sources row**: beneath the passage, label "Sources" (`text-sm
  text-ink-muted`), horizontal wrap of **SourceCard**s: `w-64 bg-panel
  rounded-xl p-4 border border-transparent transition-colors
  hover:border-accent`, containing marker number + kind badge
  (`PR #42` / `commit a1b2c3d` in `--font-mono` text-xs on
  `bg-highlight` rounded), title (2-line clamp, `--font-ui`), author ·
  relative date · repo (`text-sm text-ink-muted`). Whole card one `<a>`
  to `unit.url` (unchanged a11y name format).
- **SourcesView** (degraded, `mode: "sources_only"` from `/query`):
  passage slot instead shows serif lead-in "N decisions found —" then a
  vertical list of SourceCards **expanded**: extracted `decision` text
  as card body (serif, 3-line clamp) with `rationale` below it muted.
  Quiet banner above thread (dismissible per session): "Add a Gemini
  key in Settings to get synthesized answers." — `bg-highlight`, not
  danger.
- **LoadingCard**: keeps three-dot pulse; status line now reports the
  real stage when a first-token wait is long ("Searching decision
  history…" → "Reading 5 sources…"). Same `role="status"`.
- **Empty state**: serif prompt line + 3 example chips **generated from
  indexed repos** (template: "Why does {repo-short} use {topic}?" is
  Phase 3 polish — Phase 2 keeps 3 static-but-relevant questions built
  from indexed repo names); chips `bg-panel hover:border-accent`.
- **ErrorCard**: unchanged behavior (message + Retry, `disabled` while
  in flight); restyled: `bg-panel`, 1px `--color-danger` full border,
  danger text, plain-text detail from the server.

**Signature moment** (the one): on answer arrival, passage fades up 8px
(`--dur-surface`, `--ease-out`), then markers "ink in" — opacity 0→1
staggered 60ms each starting 180ms after passage settle; SourceCards
follow as one group (+90ms). Reduced-motion: single crossfade, no
stagger, no translate.

Repo filter chip (existing RepoFilter) stays on this page, right of the
thread header — not in global chrome.

## Library (`/library`)

Files: `frontend/src/library/LibraryPage.jsx`, `RepoRow.jsx`,
`IndexProgress.jsx`, shared hook `frontend/src/lib/useIngestStatus.js`
(single poll loop: 2s while a job is active, stopped otherwise —
StatusPill, Library, and Onboarding Step 3 all consume this one hook via
context; never two concurrent pollers).

Page: heading "Library" (`--font-reading` text-lg) + **Add repos**
button (opens the RepoPicker in a panel — reuses `RepoPickerStep`
internals). One **RepoRow** per configured repo: `bg-panel rounded-xl
p-4`, grid: `owner/name` (`--font-mono`) + status line + right-aligned
actions (Re-index, Remove — text buttons, `text-sm`).

| Row state | Status line (all `text-sm text-ink-muted`) |
|---|---|
| idle, indexed | "312 decisions · indexed 2 days ago" |
| queued | "Queued…" |
| fetching | "Reading commits — 214 examined" (live counts) |
| extracting | "Extracting decisions — 37 recorded of 214" + thin progress bar (`h-1 rounded bg-highlight`, fill `bg-accent`, width = extracted/fetched) |
| embedding | "Embedding 37 decisions…" |
| failed | danger text: exact server error + **Retry** |
| stale (>30 days) | idle line + " · consider re-indexing" |

Empty state (no repos): serif prompt "Nothing in the library yet." +
Add repos button. Remove asks inline confirmation (row swaps to
"Remove owner/repo and its N indexed decisions? **Remove** / Cancel" —
no modal), then `PATCH /config` + index cleanup.

## Settings (`/settings`)

Files: `frontend/src/settings/SettingsPage.jsx` + one component per
section (`GitHubSection.jsx`, `GeminiSection.jsx`, `ModelsSection.jsx`,
`DataSection.jsx`). Single column `max-w-xl`, each section a `bg-panel
rounded-xl p-4` group with `text-lg` head. All reads from `GET /config`
(secrets masked server-side: `ghp_…4f2a`), writes via `PATCH /config`
with per-field save + inline result (no global Save).

| Section | Contents | States |
|---|---|---|
| GitHub | connected account (`login`, avatar 20px), scopes note, **Reconnect** (restarts device flow inline), **Disconnect** (inline confirm; warns indexing stops working) | token revoked/expired: section shows danger banner "GitHub connection expired" + Reconnect (this state also triggers a global quiet banner on Ask) |
| Gemini key | masked input, Save; explainer line ("Only retrieved snippets are sent — never your code.") | on save: validate with a 1-token ping; invalid → danger inline "Key rejected by Gemini"; valid → "✓ Synthesized answers on"; removing key → confirm, app returns to sources-only |
| Models | Ollama host, extraction model, embedding model (text inputs, `--font-mono`); "Advanced" summary/details collapse | save pings Ollama `/api/tags`; model missing → warning with `ollama pull` command shown in mono |
| Data | index location (read-only path, mono), decision count, **Clear index** (danger text button, inline confirm "Clear N indexed decisions? This cannot be undone.") | — |

## Responsive behavior

| Breakpoint | Changes |
|---|---|
| ≥1024px | shell `max-w-5xl`; Ask thread `max-w-3xl`; Settings/pickers `max-w-xl` |
| 640–1024px | same structure, gutters `px-6` → `px-4` |
| <640px | nav → icons; StatusPill → dot; SourceCards full-width stacked (`w-full`, not `w-64`); RepoRow wraps to two lines (name+actions / status); onboarding cards full-width `mx-4`; **fix the Phase 1 mobile input-bar clipping**: input bar `p-3`, textarea `text-base`, no fixed heights |

## Accessibility (WCAG 2.1 AA — binding)

- Contrast verified per issue (tokens above are starting points).
- Full keyboard paths: onboarding is Tab-completable end to end; citation
  markers are `<button>`s in tab order (focus = same highlight as hover);
  RepoPicker rows toggle on Space; roving focus in RepoFilter unchanged.
- Focus visible always: 2px `--color-accent` ring, `outline-offset: 2px`.
- Live regions: StatusPill and per-repo status lines `aria-live="polite"`;
  device-code state changes announced; answer arrival announced via the
  existing `role="status"` → content swap.
- Never color-only: failed states pair danger color with text; markers
  are numbered, not color-coded.
- Reduced motion: every animation above lists its fallback.

## Do / Don't (Phase 2)

| ✅ Do | ❌ Don't |
|---|---|
| Serif for reading, sans for chrome, mono only when content is code-like | Display/serif type in buttons, labels, or data |
| One accent, semantic states, `--color-highlight` for washes | Solid accent slabs on large surfaces (except Onboarding step 1) |
| Honest progress with real counts from the status endpoint | Bare spinners or fake percentages |
| Inline confirmations (row swap) | Modals as first resort |
| Both themes in the same commit; tokens only | `dark:` classes, hardcoded hex, cream/parchment body tints |
