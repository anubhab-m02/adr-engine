// Settings' Models section (UI-DESIGN.md): Ollama host and model name
// inputs, saved together via a single PATCH /config.
//
// UI-DESIGN.md calls for save to ping Ollama's `/api/tags` to validate
// host/model reachability. Issue #83 explicitly rules this out ("Skip
// adding a new Ollama-health backend endpoint... flag as a follow-up if
// a live check turns out to be genuinely needed") — same doc/issue
// disagreement as GeminiSection's live-verification note, resolved the
// same way: follow the issue's explicit scope, PATCH-only, no live
// Ollama check.
import { useEffect, useState } from 'react'
import { getConfig, patchConfig } from '../api.js'

function ModelsSection() {
  const [loaded, setLoaded] = useState(false)
  const [host, setHost] = useState('')
  const [extractionModel, setExtractionModel] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getConfig()
      .then((result) => {
        if (cancelled) return
        setHost(result.ollama_host ?? '')
        setExtractionModel(result.ollama_extraction_model ?? '')
        setEmbeddingModel(result.ollama_embedding_model ?? '')
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await patchConfig({
        ollama_host: host,
        ollama_extraction_model: extractionModel,
        ollama_embedding_model: embeddingModel,
      })
      setSaved(true)
    } catch {
      setError('Could not save model settings. Check them and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-panel rounded-xl p-4">
      <h2 className="text-lg text-ink">Models</h2>

      {!loaded && (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          Loading…
        </p>
      )}

      {loaded && (
        <>
          <div className="mt-2 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              Ollama host
              <input
                type="text"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                className="font-mono rounded-lg border border-transparent bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              Extraction model
              <input
                type="text"
                value={extractionModel}
                onChange={(event) => setExtractionModel(event.target.value)}
                placeholder="phi4-mini (default)"
                className="font-mono rounded-lg border border-transparent bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              Embedding model
              <input
                type="text"
                value={embeddingModel}
                onChange={(event) => setEmbeddingModel(event.target.value)}
                placeholder="nomic-embed-text (default)"
                className="font-mono rounded-lg border border-transparent bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-lg bg-accent text-accent-ink text-sm font-semibold px-4 py-2 disabled:opacity-50"
            >
              Save
            </button>
            {saved && (
              <span role="status" className="text-sm text-ink-muted">
                Saved
              </span>
            )}
          </div>

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

export default ModelsSection
