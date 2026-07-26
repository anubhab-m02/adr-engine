// Onboarding step 4 (optional, last in the flow). Advancing is the
// caller's responsibility via onComplete, same pattern as
// ConnectStep/RepoPickerStep/IndexStep — so this composes cleanly
// whenever an OnboardingPage state machine wires it in, rather than
// being a special case that owns navigation itself.
//
// Per the issue's scope, this step does not live-validate the key —
// PATCH /config already validates cheaply; full validation UX belongs
// to Settings' GeminiSection. A failed PATCH still needs *some*
// feedback, though, so a save error is shown inline and the key is
// kept so the user isn't forced to retype it.
import { useState } from 'react'
import { patchConfig } from '../api.js'

function GeminiKeyStep({ onComplete }) {
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    setSubmitting(true)
    setError(null)
    try {
      await patchConfig({ gemini_api_key: key })
      onComplete()
    } catch {
      setError('Could not save the key. Check it and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    onComplete()
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="text-lg text-ink">Add a Gemini key to get synthesized answers (optional)</h2>

      <input
        type="password"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        placeholder="Gemini API key"
        aria-label="Gemini API key"
        className="mt-4 w-full rounded-lg border border-transparent bg-surface px-3 py-2 text-sm text-ink"
      />

      <p className="mt-2 text-sm text-ink-muted">
        Only the retrieved snippets you ask about are ever sent to Gemini.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={!key || submitting}
          onClick={handleSave}
          className="rounded-lg bg-accent text-accent-ink text-sm font-semibold px-4 py-2 disabled:opacity-50"
        >
          Save
        </button>

        <button type="button" onClick={handleSkip} className="text-sm text-ink-muted">
          Skip for now
        </button>
      </div>
    </div>
  )
}

export default GeminiKeyStep
