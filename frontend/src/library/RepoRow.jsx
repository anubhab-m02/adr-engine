// One row per configured repo (UI-DESIGN.md's Library spec). Presentational
// only — reads the shared useIngestStatus poller to decide whether to swap
// its static decision count for the live IndexProgress line. Remove asks
// for inline confirmation (no modal, per UI-DESIGN.md) before calling the
// onRemove callback LibraryPage supplies.
import { useState } from 'react'
import InlineConfirm from '../components/InlineConfirm.jsx'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import IndexProgress from './IndexProgress.jsx'

function hasActiveJob(status, repo) {
  const repoState = status?.repos.find((r) => r.repo === repo)
  return repoState != null && repoState.phase !== 'done' && repoState.phase !== 'failed'
}

function RepoRow({ repo, onRemove }) {
  const { status } = useIngestStatus()
  const active = hasActiveJob(status, repo.repo)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirmRemove() {
    setRemoving(true)
    setError(null)
    try {
      await onRemove(repo.repo)
    } catch {
      setError("Couldn't remove this repo.")
      setRemoving(false)
    }
  }

  if (confirming) {
    return (
      <div className="bg-panel rounded-xl p-4 flex items-center justify-between gap-4">
        <InlineConfirm
          message={`Remove ${repo.repo} and its ${repo.indexed_units} indexed ${
            repo.indexed_units === 1 ? 'decision' : 'decisions'
          }?`}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirming(false)}
          disabled={removing}
          error={error}
        />
      </div>
    )
  }

  return (
    <div className="bg-panel rounded-xl p-4 flex items-center justify-between gap-4">
      <span className="font-mono text-sm text-ink">{repo.repo}</span>
      <div className="flex items-center gap-4">
        {active ? (
          <IndexProgress repo={repo.repo} />
        ) : (
          <p className="text-sm text-ink-muted">
            {repo.indexed_units} {repo.indexed_units === 1 ? 'decision' : 'decisions'}
          </p>
        )}
        <button type="button" onClick={() => setConfirming(true)} className="text-sm text-ink-muted">
          Remove
        </button>
      </div>
    </div>
  )
}

export default RepoRow
