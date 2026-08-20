// The reading room's citation card — evolved from the Phase 1
// CitationCard. Its `id` (`source-{unit.id}`) is the scroll target that
// CitationMarker's `#source-{unitId}` href/click handler jumps to.
function badgeText(unit) {
  return unit.kind === 'pr' ? `PR #${unit.ref}` : `commit ${unit.ref.slice(0, 7)}`
}

function relativeDate(dateString) {
  const date = new Date(dateString)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const divisions = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ]

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  let duration = seconds
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return formatter.format(Math.round(duration), unit)
    }
    duration /= amount
  }
  return formatter.format(Math.round(duration), 'year')
}

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
function SourceCard({ unit, number, widthClassName = 'w-full sm:w-64', highlighted = false }) {
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
      <p className="font-ui text-base text-ink mt-2 line-clamp-2">{unit.title}</p>
      <p className="text-sm text-ink-muted mt-2">
        {unit.author} · {relativeDate(unit.date)} · {unit.repo}
      </p>
    </a>
  )
}

export default SourceCard
