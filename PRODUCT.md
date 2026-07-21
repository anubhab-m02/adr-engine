# Product

## Register

product

## Platform

web

## Users

Developers — solo maintainers and small-team engineers — running adr-engine
locally against repos they work on. They arrive mid-task: about to refactor
something old, reviewing an unfamiliar module, or onboarding onto a codebase
whose decisions predate them. They are fluent in tools like Linear, GitHub,
and their IDE, and they judge product quality quickly.

## Product Purpose

adr-engine answers "why is this built this way?" with prose cited back to
the exact commit or PR where the decision happened, mined automatically
from GitHub history — no one has to remember to write an ADR. Success in
Phase 2: a new user goes from launch to their first cited answer in
minutes without touching a config file, and the app keeps earning return
visits before every dive into old code.

## Positioning

Ask your codebase why — and get an answer cited to the commit where it was
decided, without your code ever leaving your machine.

## Brand Personality

Archival, precise, calm. The product is a reading room for a codebase's
memory: answers read like well-typeset annotated pages, not chat bubbles.
Interface chrome stays quiet and crisp; the identity lives in the reading
surface — a serif reading voice, careful citation typography, unhurried
microcopy that reports exactly what the system examined and knows.

## Anti-references

- Terminal-native dev-tool aesthetics (Warp/Raycast lane): monospace-led,
  dense, neon-on-black. The saturated reflex for developer tools.
- Stock Tailwind chat templates and ChatGPT-clone chat UIs — the current
  Phase 1 look this redesign explicitly replaces.
- SaaS dashboard grammar: hero metrics, card grids, gradient accents.

## Design Principles

1. **Citations are the product.** Every claim traceable; sources always one
   glance away, never buried behind a click.
2. **Answers are read, not skimmed.** The reading surface gets typographic
   care (measure, serif voice, rhythm); chrome defers to it.
3. **Honest state.** Indexing progress, degraded modes, and failures say
   precisely what the system did and knows — never a bare spinner.
4. **Earn the privacy claim on-screen.** What runs locally and what leaves
   the machine is visible in the moments it matters, not just in a README.
5. **Familiar chrome, distinctive reading surface.** Navigation, forms, and
   controls disappear into the task; personality concentrates where users
   read.

## Accessibility & Inclusion

WCAG 2.1 AA: ≥4.5:1 body text contrast, full keyboard operability with
visible focus, correct semantics on all components, and a
reduced-motion alternative for every animation.
