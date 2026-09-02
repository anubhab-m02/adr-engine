// Shared DecisionUnit display formatting — extracted from SourceCard.jsx
// once DecisionTimeline became a second consumer, per DRY.
export function badgeText(unit) {
  return unit.kind === 'pr' ? `PR #${unit.ref}` : `commit ${unit.ref.slice(0, 7)}`
}

export function relativeDate(dateString) {
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
