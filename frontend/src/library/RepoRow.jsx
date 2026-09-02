// One row per configured repo (UI-DESIGN.md's Library spec). Presentational
// only — reads the shared useIngestStatus poller to decide whether to swap
// its static decision count for the live IndexProgress line. Remove asks
// for inline confirmation (no modal, per UI-DESIGN.md) before calling the
// onRemove callback LibraryPage supplies.
import { useState } from 'react'
import { patchRepo } from '../api.js'
import InlineConfirm from '../components/InlineConfirm.jsx'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import IndexProgress from './IndexProgress.jsx'

function hasActiveJob(status, repo) {
  const repoState = status?.repos.find((r) => r.repo === repo)
  return repoState != null && repoState.phase !== 'done' && repoState.phase !== 'failed'
}

function RepoRow({ repo, onRemove, onReindex }) {
  const { status } = useIngestStatus()
  const active = hasActiveJob(status, repo.repo)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)
  const [reindexing, setReindexing] = useState(false)
  const [reindexError, setReindexError] = useState(null)
  const [cloudAllowed, setCloudAllowed] = useState(repo.cloud_synthesis_allowed ?? true)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState(null)

  async function handleToggleCloud() {
    const next = !cloudAllowed
    setToggling(true)
    setToggleError(null)
    setCloudAllowed(next)
    try {
      await patchRepo(repo.repo, { cloud_synthesis_allowed: next })
    } catch {
      setCloudAllowed(!next)
      setToggleError("Couldn't update cloud synthesis setting.")
    } finally {
      setToggling(false)
    }
  }

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

  async function handleReindex() {
    setReindexing(true)
    setReindexError(null)
    try {
      await onReindex(repo.repo)
    } catch {
      setReindexError("Couldn't start re-indexing.")
    } finally {
      setReindexing(false)
    }
  }

  if (confirming) {
    return (
      <div className="bg-panel rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
    // <640px: two lines — name+actions, then status (UI-DESIGN.md's
    // responsive table). `sm:contents` lets the name/Remove wrapper drop
    // out of the box model at sm+ so the single Remove button can be
    // reordered next to the status line without a second DOM instance.
    <div className="bg-panel rounded-xl p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center justify-between gap-4 sm:contents">
        <span className="font-mono text-sm text-ink truncate min-w-0">{repo.repo}</span>
        <div className="flex items-center gap-3 shrink-0 sm:order-3">
          <button
            type="button"
            role="switch"
            aria-checked={cloudAllowed}
            onClick={handleToggleCloud}
            disabled={toggling}
            className="text-sm text-ink-muted disabled:opacity-50"
          >
            {cloudAllowed ? 'Cloud synthesis: on' : 'Cloud synthesis: off'}
          </button>
          <button
            type="button"
            onClick={handleReindex}
            disabled={reindexing}
            className="text-sm text-ink-muted disabled:opacity-50"
          >
            {reindexing ? 'Re-indexing…' : 'Re-index'}
          </button>
          <button type="button" onClick={() => setConfirming(true)} className="text-sm text-ink-muted">
            Remove
          </button>
        </div>
      </div>
      <div className="sm:order-2">
        {active ? (
          <IndexProgress repo={repo.repo} indexedAt={repo.indexed_at} />
        ) : repo.indexed_units === 0 ? (
          <p className="text-sm text-ink-muted">
            No decisions extracted yet — commits may be too terse for extraction to find a decision, or try Re-index
            if this seems wrong
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            {repo.indexed_units} {repo.indexed_units === 1 ? 'decision' : 'decisions'}
          </p>
        )}
        {reindexError && (
          <p role="alert" className="text-sm text-danger">
            {reindexError}
          </p>
        )}
        {toggleError && (
          <p role="alert" className="text-sm text-danger">
            {toggleError}
          </p>
        )}
      </div>
    </div>
  )
}

export default RepoRow
