// Persistent indicator of background ingestion state, visible from
// anywhere in the app shell (UI-DESIGN.md). Presentational only — reads
// the shared useIngestStatus poller, no local polling of its own.
//
// UI-DESIGN.md's StatusPill spec calls for `bg-highlight` and a
// `--dur-surface` fade — neither token exists yet (the editorial OKLCH
// token system is its own later batch-J issue). Uses the current
// accent/danger tokens instead so this doesn't invent a token ad hoc;
// swap in `bg-highlight`/`--dur-surface` when that issue lands.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIngestStatus } from '../lib/useIngestStatus.js'

const COMPLETION_DISPLAY_MS = 4000

function inProgressLabel(repos) {
  const inProgress = repos.filter((repo) => repo.phase !== 'done' && repo.phase !== 'failed')
  if (inProgress.length === 0) return null
  if (inProgress.length === 1) return `Indexing ${inProgress[0].repo}…`
  return `Indexing ${inProgress.length} repos…`
}

function Pill({ tone, dotClassName, children, onClick }) {
  const toneClassName = tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
  return (
    <button
      type="button"
      role="status"
      aria-live="polite"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg text-sm px-3 py-1 ${toneClassName}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClassName}`} aria-hidden="true" />
      <span className="hidden sm:inline">{children}</span>
    </button>
  )
}

function StatusPill() {
  const { status } = useIngestStatus()
  const navigate = useNavigate()
  const [showCompletion, setShowCompletion] = useState(false)
  const [dismissedFailure, setDismissedFailure] = useState(null)
  const wasActiveRef = useRef(false)

  const failedRepos = status?.repos.filter((repo) => repo.phase === 'failed') ?? []
  const failureKey = failedRepos.length ? failedRepos.map((repo) => repo.repo).join(',') : null
  const hasUndismissedFailure = failureKey !== null && failureKey !== dismissedFailure

  useEffect(() => {
    if (!status) return

    if (status.active) {
      wasActiveRef.current = true
      setShowCompletion(false)
      return
    }

    if (wasActiveRef.current && failedRepos.length === 0) {
      setShowCompletion(true)
      const timer = setTimeout(() => setShowCompletion(false), COMPLETION_DISPLAY_MS)
      wasActiveRef.current = false
      return () => clearTimeout(timer)
    }

    wasActiveRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.active, failedRepos.length])

  function goToLibrary() {
    if (hasUndismissedFailure) setDismissedFailure(failureKey)
    navigate('/library')
  }

  if (!status) return null

  if (hasUndismissedFailure) {
    return (
      <Pill tone="danger" dotClassName="bg-danger" onClick={goToLibrary}>
        Indexing failed
      </Pill>
    )
  }

  if (showCompletion) {
    return (
      <Pill tone="accent" dotClassName="bg-accent" onClick={goToLibrary}>
        ✓ Indexed
      </Pill>
    )
  }

  if (!status.active) return null

  const label = inProgressLabel(status.repos)
  if (!label) return null

  return (
    <Pill tone="accent" dotClassName="bg-accent animate-pulse" onClick={goToLibrary}>
      {label}
    </Pill>
  )
}

export default StatusPill
