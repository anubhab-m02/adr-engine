// Track B's decision graph: a static, non-physics layout of a repo's
// decisions grouped by date. ROADMAP.md's Product decisions section
// rejected `d3-force` as a new dependency for a single view — this is a
// fixed grid per date group instead of a force simulation, no edges
// (co-occurrence edges are a possible follow-up, out of scope here).
// Shares fetch/loading/error/date-grouping conventions with
// DecisionTimeline.jsx via lib/sourceFormat.js.
import { useEffect, useState } from 'react'
import { getDecisions } from '../api.js'
import { badgeText, groupByDate } from '../lib/sourceFormat.js'

const COLUMNS = 10
const CELL = 40
const RADIUS = 14

const KIND_COLOR = {
  pr: 'var(--color-accent)',
  commit: 'var(--color-ink-muted)',
}

function nodePosition(index) {
  const column = index % COLUMNS
  const row = Math.floor(index / COLUMNS)
  return { x: column * CELL + CELL / 2, y: row * CELL + CELL / 2 }
}

function DecisionGraph({ repo }) {
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
    return <p className="text-sm text-ink-muted">Loading graph…</p>
  }
  if (units === 'error') {
    return <p className="text-sm text-danger">Couldn't load the graph.</p>
  }
  if (units.length === 0) {
    return <p className="font-reading text-ink">No decisions indexed yet.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {groupByDate(units).map((group) => {
        const rows = Math.ceil(group.units.length / COLUMNS)
        return (
          <div key={group.label}>
            <h2 className="font-ui text-xs uppercase tracking-wide text-ink-muted">{group.label}</h2>
            <svg width={COLUMNS * CELL} height={rows * CELL} className="mt-2">
              {group.units.map((unit, index) => {
                const { x, y } = nodePosition(index)
                return (
                  <a
                    key={unit.id}
                    href={unit.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${unit.title}, ${badgeText(unit)}`}
                  >
                    <circle cx={x} cy={y} r={RADIUS} fill={KIND_COLOR[unit.kind] ?? KIND_COLOR.commit} />
                  </a>
                )
              })}
            </svg>
          </div>
        )
      })}
    </div>
  )
}

export default DecisionGraph
