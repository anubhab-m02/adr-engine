// Retry action for a failed repo row (Library indexing view). Calls
// POST /ingest/retry/{repo} and lets the caller decide what "success"
// means (IndexProgress passes its useIngestStatus refetch) — this
// component only owns its own pending/error state.
import { useState } from 'react'
import { retryIngest } from '../api.js'

function RetryButton({ repo, onRetried }) {
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState(null)

  async function handleClick() {
    setRetrying(true)
    setError(null)
    try {
      await retryIngest(repo)
      onRetried?.()
    } catch {
      setError("Couldn't retry this repo.")
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={retrying}
        className="text-sm font-semibold text-accent disabled:opacity-50"
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export default RetryButton
