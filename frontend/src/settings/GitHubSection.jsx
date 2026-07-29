// Settings' GitHub section (UI-DESIGN.md): shows the connected account
// (avatar, login, scope), lets the user reconnect (restarts the device
// flow inline, reusing onboarding's ConnectStep/DeviceCodeCard) or
// disconnect (inline confirm, no modal). A stored token GitHub no
// longer accepts (revoked/expired outside the app) shows a distinct
// danger banner rather than collapsing into plain "disconnected".
//
// Not implemented here: UI-DESIGN.md also calls for the expired state
// to trigger "a global quiet banner on Ask" — that's a cross-page
// concern (AskPage would need to check auth status too), out of scope
// for this section component alone.
import { useEffect, useState } from 'react'
import InlineConfirm from '../components/InlineConfirm.jsx'
import ConnectStep from '../onboarding/ConnectStep.jsx'
import { disconnectGithub, getAuthStatus } from '../api.js'

function applyStatus(result, setStatus, setLogin, setAvatarUrl) {
  if (result.state === 'authorized') {
    setLogin(result.login)
    setAvatarUrl(result.avatar_url)
    setStatus('connected')
  } else if (result.state === 'expired') {
    setStatus('expired')
  } else {
    setStatus('disconnected')
  }
}

function GitHubSection() {
  const [status, setStatus] = useState(undefined)
  const [login, setLogin] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    let cancelled = false

    getAuthStatus()
      .then((result) => {
        if (!cancelled) applyStatus(result, setStatus, setLogin, setAvatarUrl)
      })
      .catch(() => {
        if (!cancelled) setStatus('disconnected')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await disconnectGithub()
      setStatus('disconnected')
      setLogin(null)
      setAvatarUrl(null)
      setConfirming(false)
    } finally {
      setDisconnecting(false)
    }
  }

  function handleReconnected() {
    setReconnecting(false)
    getAuthStatus()
      .then((result) => applyStatus(result, setStatus, setLogin, setAvatarUrl))
      .catch(() => setStatus('disconnected'))
  }

  if (reconnecting) {
    return (
      <section className="bg-panel rounded-xl p-4">
        <h2 className="text-lg text-ink">GitHub</h2>
        <div className="mt-2">
          <ConnectStep onAuthorized={handleReconnected} />
        </div>
      </section>
    )
  }

  return (
    <section className="bg-panel rounded-xl p-4">
      <h2 className="text-lg text-ink">GitHub</h2>

      {status === undefined && (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          Loading…
        </p>
      )}

      {status === 'expired' && (
        <div className="mt-2">
          <p role="alert" className="text-sm text-danger">
            GitHub connection expired
          </p>
          <button
            type="button"
            onClick={() => setReconnecting(true)}
            className="mt-2 rounded-lg bg-accent text-accent-ink text-sm font-semibold px-4 py-2"
          >
            Reconnect
          </button>
        </div>
      )}

      {status === 'connected' && !confirming && (
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {avatarUrl && <img src={avatarUrl} alt={`${login}'s avatar`} width={20} height={20} className="rounded-full" />}
            <div>
              <p className="text-sm text-ink">Connected as {login}</p>
              <p className="text-xs text-ink-muted">Scope: repo</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button type="button" onClick={() => setReconnecting(true)} className="text-sm text-ink-muted">
              Reconnect
            </button>
            <button type="button" onClick={() => setConfirming(true)} className="text-sm text-ink-muted">
              Disconnect
            </button>
          </div>
        </div>
      )}

      {status === 'connected' && confirming && (
        <div className="mt-2 flex items-center justify-between gap-4">
          <InlineConfirm
            message="Disconnect GitHub? Indexing stops working until you reconnect."
            confirmLabel="Disconnect"
            onConfirm={handleDisconnect}
            onCancel={() => setConfirming(false)}
            disabled={disconnecting}
          />
        </div>
      )}

      {status === 'disconnected' && <p className="mt-2 text-sm text-ink-muted">Not connected.</p>}
    </section>
  )
}

export default GitHubSection
