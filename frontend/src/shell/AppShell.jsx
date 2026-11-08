import { Outlet } from 'react-router-dom'
import CommandPalette from '../components/CommandPalette.jsx'
import useReadingPreferences from '../lib/useReadingPreferences.js'
import TopNav from './TopNav.jsx'

function AppShell() {
  const { focusMode, toggleFocusMode } = useReadingPreferences()

  return (
    <div className="min-h-svh bg-surface text-ink flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-panel focus:text-ink focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>
      {!focusMode && <TopNav />}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
      <CommandPalette focusModeActive={focusMode} onToggleFocusMode={toggleFocusMode} />
    </div>
  )
}

export default AppShell
