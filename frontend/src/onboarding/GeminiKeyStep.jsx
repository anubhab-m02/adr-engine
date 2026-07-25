// Onboarding step 4 (optional): the last step of the flow, so unlike
// the earlier steps it owns navigation itself rather than handing an
// onComplete callback up to an OnboardingPage state machine (that
// orchestrator doesn't exist yet). Per the issue's scope, this step
// does not live-validate the key — PATCH /config already validates
// cheaply; full validation UX belongs to Settings' GeminiSection.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchConfig } from '../api.js'

function GeminiKeyStep() {
  const navigate = useNavigate()
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    setSubmitting(true)
    try {
      await patchConfig({ gemini_api_key: key })
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    navigate('/')
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

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={!key || submitting}
          onClick={handleSave}
          className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
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
