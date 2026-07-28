// Settings' GitHub section (UI-DESIGN.md): shows the connected account
// and lets the user disconnect (inline confirm, no modal — same pattern
// as Library's RepoRow remove). Reconnect (restarting the device flow
// inline) reuses onboarding's ConnectStep/DeviceCodeCard machinery and
// is out of scope for this issue.
import { useEffect, useState } from 'react'
import { disconnectGithub, getAuthStatus } from '../api.js'

function GitHubSection() {
  const [status, setStatus] = useState(undefined)
  const [login, setLogin] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    let cancelled = false

    getAuthStatus()
      .then((result) => {
        if (cancelled) return
        if (result.state === 'authorized') {
          setLogin(result.login)
          setStatus('connected')
        } else {
          setStatus('disconnected')
        }
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
      setConfirming(false)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <section className="bg-panel rounded-xl p-4">
      <h2 className="text-lg text-ink">GitHub</h2>

      {status === undefined && (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          Loading…
        </p>
      )}

      {status === 'connected' && !confirming && (
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-sm text-ink">Connected as {login}</p>
          <button type="button" onClick={() => setConfirming(true)} className="text-sm text-ink-muted">
            Disconnect
          </button>
        </div>
      )}

      {status === 'connected' && confirming && (
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-sm text-ink">Disconnect GitHub? Indexing stops working until you reconnect.</p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={disconnecting}
              onClick={handleDisconnect}
              className="text-sm font-semibold text-danger disabled:opacity-50"
            >
              Disconnect
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-sm text-ink-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'disconnected' && <p className="mt-2 text-sm text-ink-muted">Not connected.</p>}
    </section>
  )
}

export default GitHubSection
