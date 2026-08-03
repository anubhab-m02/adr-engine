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

function SourceCard({ unit, number }) {
  const accessibleName = `Citation: ${unit.title}, ${unit.kind} in ${unit.repo}`

  return (
    <a
      id={`source-${unit.id}`}
      href={unit.url}
      target="_blank"
      rel="noreferrer"
      aria-label={accessibleName}
      className="block w-full sm:w-64 rounded-xl border border-transparent bg-panel p-4 transition-colors hover:border-accent"
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
