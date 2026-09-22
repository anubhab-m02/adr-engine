// Track B's decision timeline: a chronological, grouped-by-date list of a
// repo's decisions, fed by GET /decisions. Reuses SourceCard.jsx's
// badge/date formatting, plus the date-grouping helpers (via the shared
// lib/sourceFormat.js module, now that DecisionGraph is a second
// consumer of both) instead of reimplementing them.
import { useEffect, useState } from 'react'
import { getDecisions } from '../api.js'
import { badgeText, groupByDate, relativeDate } from '../lib/sourceFormat.js'

function DecisionTimeline({ repo }) {
  const [units, setUnits] = useState(undefined)
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  useEffect(() => {
    let cancelled = false
    setUnits(undefined)
    getDecisions({ repo, since: since || undefined, until: until || undefined })
      .then((result) => {
        if (!cancelled) setUnits(result.units)
      })
      .catch(() => {
        if (!cancelled) setUnits('error')
      })
    return () => {
      cancelled = true
    }
  }, [repo, since, until])

  const filters = (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        From
        <input
          type="date"
          value={since}
          onChange={(event) => setSince(event.target.value)}
          className="bg-panel rounded px-2 py-1 text-sm text-ink"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        To
        <input
          type="date"
          value={until}
          onChange={(event) => setUntil(event.target.value)}
          className="bg-panel rounded px-2 py-1 text-sm text-ink"
        />
      </label>
    </div>
  )

  let content
  if (units === undefined) {
    content = <p className="text-sm text-ink-muted">Loading timeline…</p>
  } else if (units === 'error') {
    content = <p className="text-sm text-danger">Couldn't load the timeline.</p>
  } else if (units.length === 0) {
    content = <p className="font-reading text-ink">No decisions indexed yet.</p>
  } else {
    content = groupByDate(units).map((group) => (
      <div key={group.label}>
        <h2 className="font-ui text-xs uppercase tracking-wide text-ink-muted">{group.label}</h2>
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
    ))
  }

  return (
    <div className="flex flex-col gap-6">
      {filters}
      {content}
    </div>
  )
}

export default DecisionTimeline
