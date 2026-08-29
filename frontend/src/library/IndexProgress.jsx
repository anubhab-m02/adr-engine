// Per-repo ingestion progress line, reused verbatim by Onboarding's Step
// 3 and the Library page (UI-DESIGN.md). Presentational only — reads the
// shared useIngestStatus poller, no local polling of its own.
import { relativeDate } from '../lib/sourceFormat.js'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import RetryButton from './RetryButton.jsx'

const PHASE_LABELS = {
  queued: () => 'Queued…',
  fetching: (counts) => `Reading commits — ${counts.fetched} examined`,
  extracting: (counts) => `Extracting decisions — ${counts.extracted} recorded of ${counts.fetched}`,
  embedding: (counts) => `Embedding ${counts.extracted} decisions…`,
  done: (counts, indexedAt) =>
    indexedAt
      ? `Indexed ${counts.stored} decisions · indexed ${relativeDate(indexedAt)}`
      : `Indexed ${counts.stored} decisions`,
}

function extractProgressPercent(counts) {
  if (!counts.fetched) return 0
  return Math.min(100, (counts.extracted / counts.fetched) * 100)
}

function IndexProgress({ repo, indexedAt = null }) {
  const { status, refetch } = useIngestStatus()
  const repoState = status?.repos.find((r) => r.repo === repo)

  if (!repoState) return null

  if (repoState.phase === 'failed') {
    return (
      <div>
        <p className="text-sm text-danger" role="status">
          {repoState.error}
        </p>
        <RetryButton repo={repo} onRetried={refetch} />
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-ink-muted" role="status">
        {PHASE_LABELS[repoState.phase](repoState.counts, indexedAt)}
      </p>
      {repoState.phase === 'extracting' && (
        <div className="h-1 rounded bg-surface">
          <div className="h-1 rounded bg-accent" style={{ width: `${extractProgressPercent(repoState.counts)}%` }} />
        </div>
      )}
    </div>
  )
}

export default IndexProgress
