// Onboarding step 1's device-code UI: shows the GitHub device code and
// polls GET /auth/github/status at the server-provided interval until
// the user authorizes, the code expires, or authorization is denied.
// UI-DESIGN.md calls for `--color-accent-ink`/`--font-mono` tokens that
// don't exist yet (the editorial token system is a later batch-J issue)
// — uses the current accent/danger tokens and Tailwind's built-in
// `font-mono` instead, per the precedent set in shell/StatusPill.jsx.
import { useEffect, useRef, useState } from 'react'
import { getAuthStatus } from '../api.js'

const AUTHORIZED_ADVANCE_DELAY_MS = 800
const COPIED_LABEL_DURATION_MS = 2000

function DeviceCodeCard({ userCode, verificationUri, interval, onAuthorized, onRestart }) {
  const [state, setState] = useState('pending')
  const [login, setLogin] = useState(null)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      let result
      try {
        result = await getAuthStatus()
      } catch {
        if (!cancelled) setState('network-error')
        return
      }
      if (cancelled) return

      setState(result.state)

      if (result.state === 'authorized') {
        setLogin(result.login)
        setTimeout(() => {
          if (!cancelled) onAuthorized(result.login)
        }, AUTHORIZED_ADVANCE_DELAY_MS)
        return
      }

      if (result.state === 'pending') {
        timerRef.current = setTimeout(poll, interval * 1000)
      }
    }

    poll()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [interval, onAuthorized])

  function handleCopy() {
    navigator.clipboard?.writeText(userCode)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS)
  }

  if (state === 'authorized') {
    return (
      <div role="status" className="rounded-xl bg-panel p-4 text-ink">
        ✓ Connected as {login}
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="rounded-xl bg-panel p-4">
        <p className="text-ink-muted text-sm">Code expired.</p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-2 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2"
        >
          Get a new code
        </button>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="rounded-xl bg-panel p-4">
        <p className="text-danger text-sm">Authorization was denied.</p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-2 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2"
        >
          Retry
        </button>
      </div>
    )
  }

  if (state === 'network-error') {
    return (
      <div className="rounded-xl bg-panel p-4 border border-danger">
        <p className="text-danger text-sm">Could not reach the backend. Is it running?</p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-2 rounded-lg bg-danger text-white text-sm font-semibold px-4 py-2"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-panel p-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-2xl tracking-widest text-ink">{userCode}</span>
        <button type="button" aria-label="Copy code" onClick={handleCopy} className="text-sm text-accent">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <a
        href={verificationUri}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-sm text-accent"
      >
        Open github.com/login/device
      </a>
      <p role="status" className="mt-2 text-sm text-ink-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse mr-1" aria-hidden="true" />
        Waiting for approval…
      </p>
    </div>
  )
}

export default DeviceCodeCard
