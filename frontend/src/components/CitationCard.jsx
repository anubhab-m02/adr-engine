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

function CitationCard({ unit }) {
  const accessibleName = `Citation: ${unit.title}, ${unit.kind} in ${unit.repo}`

  return (
    <a
      href={unit.url}
      target="_blank"
      rel="noreferrer"
      aria-label={accessibleName}
      className="block w-64 rounded-xl border border-transparent bg-panel p-4 hover:border-accent"
    >
      <span className="inline-block rounded-lg bg-surface text-ink-muted text-sm px-2 py-1">
        {badgeText(unit)}
      </span>
      <p className="text-base text-ink mt-2 line-clamp-2">{unit.title}</p>
      <p className="text-sm text-ink-muted mt-2">
        {unit.author} · {relativeDate(unit.date)} · {unit.repo}
      </p>
    </a>
  )
}

export default CitationCard
