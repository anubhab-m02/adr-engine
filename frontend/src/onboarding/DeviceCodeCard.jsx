// Onboarding step 1's device-code UI: shows the GitHub device code and
// polls GET /auth/github/status at the server-provided interval until
// the user authorizes, the code expires, or authorization is denied.
// UI-DESIGN.md calls for `--color-accent-ink`/`--font-mono` tokens that
// don't exist yet (the editorial token system is a later batch-J issue)
// — uses the current accent/danger tokens and Tailwind's built-in
// `font-mono` instead, per the precedent set in shell/StatusPill.jsx.
import { useEffect, useRef, useState } from 'react'
import { getAuthStatus } from '../api.js'
import RetryCard from './RetryCard.jsx'

const AUTHORIZED_ADVANCE_DELAY_MS = 800
const COPIED_LABEL_DURATION_MS = 2000
const CROSSFADE_DURATION_MS = 300

function DeviceCodeCard({ userCode, verificationUri, interval, onAuthorized, onRestart }) {
  const [state, setState] = useState('pending')
  const [login, setLogin] = useState(null)
  const [copied, setCopied] = useState(false)
  const [authorizedVisible, setAuthorizedVisible] = useState(false)
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

  useEffect(() => {
    if (state !== 'authorized') return
    // Two Tailwind transition utilities, no custom keyframes — start
    // transparent, flip to opaque next frame so the CSS transition runs.
    const raf = requestAnimationFrame(() => setAuthorizedVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [state])

  function handleCopy() {
    navigator.clipboard?.writeText(userCode)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS)
  }

  if (state === 'authorized') {
    return (
      <div
        role="status"
        className={`rounded-xl bg-panel p-4 text-ink transition-opacity duration-300 ${
          authorizedVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${CROSSFADE_DURATION_MS}ms` }}
      >
        ✓ Connected as {login}
      </div>
    )
  }

  if (state === 'expired') {
    return <RetryCard message="Code expired." buttonLabel="Get a new code" onRetry={onRestart} />
  }

  if (state === 'denied') {
    return <RetryCard message="Authorization was denied." messageTone="danger" onRetry={onRestart} />
  }

  if (state === 'network-error') {
    return (
      <RetryCard
        message="Could not reach the backend. Is it running?"
        messageTone="danger"
        bordered
        buttonTone="danger"
        onRetry={onRestart}
      />
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
