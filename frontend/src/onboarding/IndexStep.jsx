// Onboarding step 3: kicks off the first index run and shows live
// progress. RepoPickerStep already saved the chosen repos via PATCH
// /config, but UI-DESIGN.md is explicit that this step's own action is
// `POST /ingest {repos}` — pass them explicitly rather than relying on
// the backend's indexed_repos fallback matching by coincidence.
//
// Per UI-DESIGN.md's Step 3 spec: "Start asking" appears the moment the
// first repo completes (others keep indexing in the background) and
// never blocks on a partial failure if >=1 repo succeeded. Also
// auto-advances once the whole run finishes cleanly, so a user who
// doesn't notice the button isn't stuck.
import { useEffect, useRef } from 'react'
import { postIngest } from '../api.js'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import IndexProgress from '../library/IndexProgress.jsx'

function IndexStep({ repos, onComplete }) {
  const { status, refetch } = useIngestStatus()
  const wasActiveRef = useRef(false)
  const startedRef = useRef(false)
  const advancedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    postIngest({ repos }).then(refetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!status) return

    if (status.active) {
      wasActiveRef.current = true
      return
    }

    const hasFailure = status.repos.some((repo) => repo.phase === 'failed')
    if (wasActiveRef.current && !hasFailure && !advancedRef.current) {
      advancedRef.current = true
      onComplete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  function handleStartAsking() {
    advancedRef.current = true
    onComplete()
  }

  const canStartAsking = status?.repos.some((repo) => repo.phase === 'done') ?? false

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg text-ink">Reading your history.</h1>
      <div className="mt-4 space-y-4">
        {repos.map((repo) => (
          <IndexProgress key={repo} repo={repo} />
        ))}
      </div>
      {canStartAsking && (
        <button
          type="button"
          onClick={handleStartAsking}
          className="mt-4 rounded-lg bg-accent text-accent-ink text-sm font-semibold px-4 py-2"
        >
          Start asking
        </button>
      )}
    </div>
  )
}

export default IndexStep
