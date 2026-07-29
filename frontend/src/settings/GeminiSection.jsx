// Settings' Gemini key section (UI-DESIGN.md): masked display of an
// existing key, an input to set/update it, and a remove action (inline
// confirm — same pattern as GitHubSection/RepoRow).
//
// UI-DESIGN.md's Settings table calls for a live "1-token ping" to
// Gemini on save ("Key rejected by Gemini" / "✓ Synthesized answers
// on"). Issue #82's own scope explicitly rules this out ("Live Gemini
// API key verification (out of scope everywhere per SYSTEM-DESIGN.md —
// PATCH validates format only, not by calling Gemini)") — the two docs
// disagree. Following the issue's explicit scope (and SYSTEM-DESIGN.md's
// broader "no live verification" policy) rather than silently making a
// real external API call during every key save; only cheap PATCH-side
// format validation happens here. Flagging for a docs reconciliation
// rather than resolving it unilaterally in either direction.
import { useEffect, useState } from 'react'
import InlineConfirm from '../components/InlineConfirm.jsx'
import { getConfig, patchConfig } from '../api.js'

function GeminiSection() {
  const [existingMasked, setExistingMasked] = useState(undefined)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getConfig()
      .then((result) => {
        if (!cancelled) setExistingMasked(result.gemini_api_key)
      })
      .catch(() => {
        if (!cancelled) setExistingMasked(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const result = await patchConfig({ gemini_api_key: key })
      setExistingMasked(result.gemini_api_key)
      setKey('')
    } catch {
      setError('Could not save the key. Check it and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await patchConfig({ gemini_api_key: null })
      setExistingMasked(null)
      setConfirmingRemove(false)
    } catch {
      setError('Could not remove the key.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section className="bg-panel rounded-xl p-4">
      <h2 className="text-lg text-ink">Gemini key</h2>
      <p className="mt-1 text-sm text-ink-muted">Only retrieved snippets are sent — never your code.</p>

      {existingMasked === undefined && (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          Loading…
        </p>
      )}

      {existingMasked !== undefined && (
        <>
          {existingMasked && !confirmingRemove && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-ink">{existingMasked}</span>
              <button type="button" onClick={() => setConfirmingRemove(true)} className="text-sm text-ink-muted">
                Remove
              </button>
            </div>
          )}

          {existingMasked && confirmingRemove && (
            <div className="mt-2 flex items-center justify-between gap-4">
              <InlineConfirm
                message="Remove the Gemini key? Ask returns to sources-only answers."
                onConfirm={handleRemove}
                onCancel={() => setConfirmingRemove(false)}
                disabled={removing}
              />
            </div>
          )}

          {!confirmingRemove && (
            <div className="mt-2 flex items-center gap-4">
              <input
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={existingMasked ? 'Update key' : 'Gemini API key'}
                aria-label="Gemini API key"
                className="flex-1 rounded-lg border border-transparent bg-surface px-3 py-2 text-sm text-ink"
              />
              <button
                type="button"
                disabled={!key || saving}
                onClick={handleSave}
                className="rounded-lg bg-accent text-accent-ink text-sm font-semibold px-4 py-2 disabled:opacity-50"
              >
                Save
              </button>
            </div>
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

export default GeminiSection
