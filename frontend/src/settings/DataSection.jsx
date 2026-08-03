// Settings' Data section (UI-DESIGN.md): read-only index location and
// a full-wipe "Clear index" action (destructive, inline confirm — same
// pattern as GitHubSection/GeminiSection/RepoRow). Decision count (also
// named in UI-DESIGN.md's Data row) is deliberately not shown — no such
// field exists in ConfigResponse yet; tracked as a follow-up in #95.
import { useEffect, useState } from 'react'
import InlineConfirm from '../components/InlineConfirm.jsx'
import { clearIndex, getConfig } from '../api.js'

function DataSection() {
  const [dataDir, setDataDir] = useState(undefined)
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getConfig()
      .then((result) => {
        if (!cancelled) setDataDir(result.chroma_data_dir)
      })
      .catch(() => {
        if (!cancelled) setDataDir(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleClear() {
    setClearing(true)
    setError(null)
    try {
      await clearIndex()
      setCleared(true)
      setConfirming(false)
    } catch {
      setError('Could not clear the index.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <section className="bg-panel rounded-xl p-4">
      <h2 className="text-lg text-ink">Data</h2>

      {dataDir === undefined && (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          Loading…
        </p>
      )}

      {dataDir !== undefined && (
        <>
          {dataDir && <p className="mt-1 font-mono text-sm text-ink-muted">{dataDir}</p>}

          {!confirming && (
            <button
              type="button"
              disabled={clearing}
              onClick={() => setConfirming(true)}
              className="mt-2 text-sm font-semibold text-danger disabled:opacity-50"
            >
              Clear index
            </button>
          )}

          {confirming && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <InlineConfirm
                message="Clear the index? This cannot be undone."
                confirmLabel="Clear index"
                onConfirm={handleClear}
                onCancel={() => setConfirming(false)}
                disabled={clearing}
              />
            </div>
          )}

          {cleared && (
            <p role="status" className="mt-2 text-sm text-ink-muted">
              Index cleared.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default DataSection
