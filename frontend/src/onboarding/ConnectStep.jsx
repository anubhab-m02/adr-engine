// Onboarding step 1: starts the GitHub device flow on mount and renders
// DeviceCodeCard, which owns polling GET /auth/github/status. Advancing
// to step 2 is the caller's responsibility (via onAuthorized), so this
// component composes cleanly under OnboardingPage's step machine.
import { useEffect, useState } from 'react'
import { startDeviceFlow } from '../api.js'
import DeviceCodeCard from './DeviceCodeCard.jsx'

function ConnectStep({ onAuthorized }) {
  const [device, setDevice] = useState(undefined)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setDevice(undefined)

    startDeviceFlow()
      .then((result) => {
        if (!cancelled) setDevice(result)
      })
      .catch(() => {
        if (!cancelled) setDevice('error')
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  function restart() {
    setAttempt((a) => a + 1)
  }

  if (device === undefined) {
    return (
      <p role="status" className="text-ink-muted text-sm">
        Connecting…
      </p>
    )
  }

  if (device === 'error') {
    return (
      <div className="rounded-xl bg-panel p-4 border border-danger">
        <p className="text-danger text-sm">Could not start GitHub sign-in.</p>
        <button
          type="button"
          onClick={restart}
          className="mt-2 rounded-lg bg-danger text-white text-sm font-semibold px-4 py-2"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <DeviceCodeCard
      key={attempt}
      userCode={device.user_code}
      verificationUri={device.verification_uri}
      interval={device.interval}
      onAuthorized={onAuthorized}
      onRestart={restart}
    />
  )
}

export default ConnectStep
