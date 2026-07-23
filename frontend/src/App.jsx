import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AskPage from './ask/AskPage.jsx'
import { getSetupState } from './api.js'
import AppShell from './shell/AppShell.jsx'

function isSetupComplete(state) {
  return state.github_connected && state.repos_selected && state.first_index_done
}

function App() {
  const [setupState, setSetupState] = useState(undefined)

  useEffect(() => {
    let cancelled = false

    getSetupState()
      .then((result) => {
        if (!cancelled) setSetupState(result)
      })
      .catch(() => {
        if (!cancelled) setSetupState(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (setupState === undefined) return null

  const setupComplete = setupState != null && isSetupComplete(setupState)

  return (
    <Routes>
      {setupComplete ? (
        <Route element={<AppShell />}>
          <Route path="/" element={<AskPage />} />
          <Route path="/library" element={<div className="p-6 text-ink-muted">Library</div>} />
          <Route path="/settings" element={<div className="p-6 text-ink-muted">Settings</div>} />
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <>
          <Route path="/onboarding" element={<div className="p-6">Onboarding</div>} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </>
      )}
    </Routes>
  )
}

export default App
