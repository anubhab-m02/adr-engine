// One row per configured repo (UI-DESIGN.md's Library spec). Presentational
// only — reads the shared useIngestStatus poller to decide whether to swap
// its static decision count for the live IndexProgress line.
import { useIngestStatus } from '../lib/useIngestStatus.js'
import IndexProgress from './IndexProgress.jsx'

function hasActiveJob(status, repo) {
  const repoState = status?.repos.find((r) => r.repo === repo)
  return repoState != null && repoState.phase !== 'done' && repoState.phase !== 'failed'
}

function RepoRow({ repo }) {
  const { status } = useIngestStatus()
  const active = hasActiveJob(status, repo.repo)

  return (
    <div className="bg-panel rounded-xl p-4 flex items-center justify-between gap-4">
      <span className="font-mono text-sm text-ink">{repo.repo}</span>
      {active ? (
        <IndexProgress repo={repo.repo} />
      ) : (
        <p className="text-sm text-ink-muted">
          {repo.indexed_units} {repo.indexed_units === 1 ? 'decision' : 'decisions'}
        </p>
      )}
    </div>
  )
}

export default RepoRow
