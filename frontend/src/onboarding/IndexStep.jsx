// Onboarding step 3: kicks off the first index run and shows live
// progress. RepoPickerStep already saved the chosen repos via PATCH
// /config, so POST /ingest is called with no body — the backend defaults
// to the configured indexed_repos. `repos` is only needed here to know
// which IndexProgress rows to render before the first status poll lands.
import { useEffect, useRef } from 'react'
import { postIngest } from '../api.js'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import IndexProgress from '../library/IndexProgress.jsx'

function IndexStep({ repos, onComplete }) {
  const { status, refetch } = useIngestStatus()
  const wasActiveRef = useRef(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    postIngest().then(refetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!status) return

    if (status.active) {
      wasActiveRef.current = true
      return
    }

    const hasFailure = status.repos.some((repo) => repo.phase === 'failed')
    if (wasActiveRef.current && !hasFailure) {
      onComplete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg text-ink">Reading your history.</h1>
      <div className="mt-4 space-y-4">
        {repos.map((repo) => (
          <IndexProgress key={repo} repo={repo} />
        ))}
      </div>
    </div>
  )
}

export default IndexStep
