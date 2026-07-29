// Onboarding step 1: starts the GitHub device flow on mount and renders
// DeviceCodeCard, which owns polling GET /auth/github/status. Advancing
// to step 2 is the caller's responsibility (via onAuthorized), so this
// component composes cleanly under OnboardingPage's step machine.
import { useEffect, useRef, useState } from 'react'
import { startDeviceFlow } from '../api.js'
import DeviceCodeCard from './DeviceCodeCard.jsx'
import RetryCard from './RetryCard.jsx'

function ConnectStep({ onAuthorized }) {
  const [device, setDevice] = useState(undefined)
  const [attempt, setAttempt] = useState(0)
  // POST /auth/github/device/start is not idempotent — each call mints a
  // new code and replaces the backend's one in-flight device flow. React
  // StrictMode double-invokes this effect once on mount in dev; without
  // this guard that fires two real device-flow starts for one screen,
  // racing whichever the backend ends up tracking against whichever the
  // user actually sees and approves. Mirrors IndexStep's same guard for
  // its own non-idempotent POST /ingest.
  const startedForAttempt = useRef(null)

  useEffect(() => {
    if (startedForAttempt.current === attempt) return
    startedForAttempt.current = attempt

    setDevice(undefined)
    startDeviceFlow()
      .then(setDevice)
      .catch(() => setDevice('error'))
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
      <RetryCard message="Could not start GitHub sign-in." messageTone="danger" bordered buttonTone="danger" onRetry={restart} />
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
