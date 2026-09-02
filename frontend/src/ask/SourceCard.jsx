// The reading room's citation card — evolved from the Phase 1
// CitationCard. Its `id` (`source-{unit.id}`) is the scroll target that
// CitationMarker's `#source-{unitId}` href/click handler jumps to.
import { badgeText, relativeDate } from '../lib/sourceFormat.js'

// `widthClassName` defaults to a fixed card width for the stacked-list
// contexts (SourceCardList, SourcesView). AnswerPage's margin track passes
// `w-full` instead, so the card fills whatever width the grid column
// currently has — the narrow 900-1280px track and the full 260px one
// above it — rather than a fixed width that would overflow the narrow one.
//
// `highlighted` washes the card with `--color-highlight` instead of its
// default `bg-panel` fill — CitationMarker drives this externally (by id,
// not by prop, since it doesn't render the card it's washing), but the
// prop stays the source of truth for what "highlighted" looks like so the
// two never drift out of sync.
//
// `expanded` swaps the title line for the unit's `decision`/`rationale`
// text — used by SourcesView's degraded mode, where there's no
// synthesized passage to carry that content instead.
function SourceCard({
  unit,
  number,
  widthClassName = 'w-full sm:w-64',
  highlighted = false,
  expanded = false,
}) {
  const accessibleName = `Citation: ${unit.title}, ${unit.kind} in ${unit.repo}`

  return (
    <a
      id={`source-${unit.id}`}
      href={unit.url}
      target="_blank"
      rel="noreferrer"
      aria-label={accessibleName}
      className={`block ${widthClassName} rounded-xl border border-transparent ${highlighted ? 'bg-highlight' : 'bg-panel'} p-4 transition-colors hover:border-accent`}
    >
      <div className="flex items-center gap-2">
        {number != null && <span className="font-ui text-xs text-ink-muted">{number}</span>}
        <span className="inline-block rounded bg-highlight text-ink-muted font-mono text-xs px-2 py-1">
          {badgeText(unit)}
        </span>
      </div>
      {expanded ? (
        <>
          <p className="font-reading text-ink text-base leading-relaxed mt-2 line-clamp-3">
            {unit.decision}
          </p>
          <p className="font-reading text-ink-muted text-sm leading-relaxed mt-2">
            {unit.rationale}
          </p>
        </>
      ) : (
        <p className="font-ui text-base text-ink mt-2 line-clamp-2">{unit.title}</p>
      )}
      <p className="text-sm text-ink-muted mt-2">
        {unit.author} · {relativeDate(unit.date)} · {unit.repo}
      </p>
    </a>
  )
}

export default SourceCard
