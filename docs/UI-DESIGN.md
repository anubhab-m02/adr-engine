# UI Design — adr-engine (Phase 1)

Single-page chat interface: ask a question about the indexed repos'
decision history, get a cited answer. No auth, no routing, no history
persistence in Phase 1. Built with React + Tailwind 4.

## Design tokens

Defined once as Tailwind theme values in `frontend/src/index.css`
(`@theme`). Components use these tokens only — no hardcoded hex values or
arbitrary spacing in component files.

| Token | Value | Use |
|---|---|---|
| `--color-surface` | zinc-50 / zinc-900 (dark) | page background |
| `--color-panel` | white / zinc-800 (dark) | cards, input bar |
| `--color-ink` | zinc-900 / zinc-100 (dark) | primary text |
| `--color-ink-muted` | zinc-500 / zinc-400 (dark) | metadata, timestamps |
| `--color-accent` | indigo-600 / indigo-400 (dark) | links, send button, focus rings |
| `--color-danger` | red-600 / red-400 (dark) | error states |
| Radius | `rounded-xl` cards, `rounded-lg` buttons/inputs | |
| Spacing | Tailwind scale only; card padding `p-4`, section gaps `gap-4` | |
| Type scale | `text-sm` metadata, `text-base` body, `text-lg` semibold headings | |

Dark mode: `prefers-color-scheme` via Tailwind `dark:` variants from day
one — both themes styled in the same commit as any new component.

## Layout

```
┌──────────────────────────────────────────┐
│ Header: wordmark ······ RepoFilter ▾     │  h-14, panel bg
├──────────────────────────────────────────┤
│                                          │
│  MessageList (scrolls, max-w-3xl,        │
│   centered)                              │
│    ┌─ user question (right-aligned) ─┐   │
│    └─ AnswerCard (left-aligned)      │   │
│         └─ CitationCard row          │   │
│                                          │
├──────────────────────────────────────────┤
│ ChatInput (sticky bottom, panel bg)      │
└──────────────────────────────────────────┘
```

Empty state (no messages yet): centered prompt — "Ask why something in
your codebase is the way it is" — plus 3 example-question chips that
fill the input when clicked.

## Components

### ChatInput
| | |
|---|---|
| Props | `onSubmit(question)`, `disabled` |
| States | default; focused (accent ring); disabled while a query is in flight; empty submit is a no-op |
| Keyboard | Enter submits, Shift+Enter newline |
| A11y | `<form>` with labeled textarea; submit button `aria-label="Ask"` |

### MessageList
| | |
|---|---|
| Props | `messages: [{role: "user"\|"assistant", ...}]` |
| Behavior | auto-scrolls to newest; renders QuestionBubble, AnswerCard, LoadingCard, ErrorCard by message type |

### AnswerCard
| | |
|---|---|
| Props | `answer: string`, `citations: DecisionUnit[]` |
| States | default; **no-answer** variant when citations are empty ("Nothing in the indexed history covers this") styled muted, not as an error |
| Layout | answer text, then a horizontal wrap of CitationCards |

### CitationCard
| | |
|---|---|
| Props | `unit: DecisionUnit` |
| Content | kind badge (`PR #42` / `commit a1b2c3d`), title (truncated 2 lines), author, date (relative), repo name |
| States | default; hover (border → accent, cursor pointer) |
| Behavior | opens `unit.url` on GitHub in a new tab |
| A11y | whole card is one `<a>`; announced as "Citation: {title}, {kind} in {repo}" |

### RepoFilter
| | |
|---|---|
| Props | `repos: [{repo, indexed_units}]`, `selected: string[]`, `onChange` |
| Behavior | multi-select dropdown in the header; default = all repos selected ("All repos" summary label); selection is passed as `repos` on `/query` and `/retrieve` |
| States | closed; open (panel with checkboxes); loading (skeleton while `GET /repos` resolves); single-repo installs render as a static badge, not a dropdown |
| A11y | `<button aria-haspopup="listbox">`; arrow keys + Space toggle; Escape closes |

### LoadingCard
Assistant-side placeholder while `/query` is in flight: three-dot pulse
plus rotating status text ("Searching decision history…"). Replaced
in-place by AnswerCard or ErrorCard.

### ErrorCard
| | |
|---|---|
| Props | `message`, `onRetry` |
| Variants | backend unreachable; upstream model error (surfaces server-provided message) |
| Behavior | Retry re-submits the same question |

## Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Style light and dark in the same change | Ship a component light-only |
| Use tokens/Tailwind scale | Hardcode colors or px values |
| Render "no answer" as a calm state | Dress no-answer up as an error |
| Keep components presentational; state in `App.jsx` | Fetch from inside components |

## Deferred past Phase 1
Question history sidebar, streaming answers, answer feedback (👍/👎),
mobile-specific layout work beyond responsive defaults.
