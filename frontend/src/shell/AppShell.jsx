import { Outlet } from 'react-router-dom'
import CommandPalette from '../components/CommandPalette.jsx'
import useReadingPreferences from '../lib/useReadingPreferences.js'
import TopNav from './TopNav.jsx'

function AppShell() {
  const { focusMode, toggleFocusMode } = useReadingPreferences()

  return (
    <div className="min-h-svh bg-surface text-ink flex flex-col">
      {!focusMode && <TopNav />}
      <div className="flex-1 max-w-5xl mx-auto w-full">
        <Outlet />
      </div>
      <CommandPalette focusModeActive={focusMode} onToggleFocusMode={toggleFocusMode} />
    </div>
  )
}

export default AppShell
