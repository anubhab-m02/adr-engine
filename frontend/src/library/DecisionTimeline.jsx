// Track B's decision timeline: a chronological, grouped-by-date list of a
// repo's decisions, fed by GET /decisions. Reuses SourceCard.jsx's
// badge/date formatting (via the shared lib/sourceFormat.js module, now
// that this is a second consumer) instead of reimplementing it.
import { useEffect, useState } from 'react'
import { getDecisions } from '../api.js'
import { badgeText, relativeDate } from '../lib/sourceFormat.js'

function dateGroupLabel(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// `units` already arrives newest-first from GET /decisions — grouping by
// day preserves that order both across and within groups.
function groupByDate(units) {
  const groups = []
  let current = null
  for (const unit of units) {
    const label = dateGroupLabel(unit.date)
    if (current == null || current.label !== label) {
      current = { label, units: [] }
      groups.push(current)
    }
    current.units.push(unit)
  }
  return groups
}

function DecisionTimeline({ repo }) {
  const [units, setUnits] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    setUnits(undefined)
    getDecisions({ repo })
      .then((result) => {
        if (!cancelled) setUnits(result.units)
      })
      .catch(() => {
        if (!cancelled) setUnits('error')
      })
    return () => {
      cancelled = true
    }
  }, [repo])

  if (units === undefined) {
    return <p className="text-sm text-ink-muted">Loading timeline…</p>
  }

  if (units === 'error') {
    return <p className="text-sm text-danger">Couldn't load the timeline.</p>
  }

  if (units.length === 0) {
    return <p className="font-reading text-ink">No decisions indexed yet.</p>
  }

  const groups = groupByDate(units)

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h2 className="font-ui text-xs uppercase tracking-wide text-ink-muted">
            {group.label}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {group.units.map((unit) => (
              <li key={unit.id} id={`source-${unit.id}`} className="bg-panel rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded bg-highlight text-ink-muted font-mono text-xs px-2 py-1">
                    {badgeText(unit)}
                  </span>
                </div>
                <p className="font-ui text-base text-ink mt-2">{unit.title}</p>
                <p className="text-sm text-ink-muted mt-2">
                  {unit.author} · {relativeDate(unit.date)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default DecisionTimeline
