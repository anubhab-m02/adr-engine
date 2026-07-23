// Persistent indicator of background ingestion state, visible from
// anywhere in the app shell (UI-DESIGN.md). Presentational only — reads
// the shared useIngestStatus poller, no local polling of its own.
import { useIngestStatus } from '../lib/useIngestStatus.js'

function inProgressLabel(repos) {
  const inProgress = repos.filter((repo) => repo.phase !== 'done' && repo.phase !== 'failed')
  if (inProgress.length === 0) return null
  if (inProgress.length === 1) return `Indexing ${inProgress[0].repo}…`
  return `Indexing ${inProgress.length} repos…`
}

function StatusPill() {
  const { status } = useIngestStatus()
  if (!status) return null

  if (status.repos.some((repo) => repo.phase === 'failed')) {
    return (
      <span role="status" aria-live="polite" className="rounded-lg bg-danger/10 text-danger text-sm px-3 py-1">
        Indexing failed
      </span>
    )
  }

  if (!status.active) return null

  const label = inProgressLabel(status.repos)
  if (!label) return null

  return (
    <span role="status" aria-live="polite" className="rounded-lg bg-accent/10 text-accent text-sm px-3 py-1">
      {label}
    </span>
  )
}

export default StatusPill
