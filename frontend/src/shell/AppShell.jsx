import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import CommandPalette from '../components/CommandPalette.jsx'
import useReadingPreferences from '../lib/useReadingPreferences.js'
import TopNav from './TopNav.jsx'

function AppShell() {
  const { focusMode, toggleFocusMode } = useReadingPreferences()
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const previousPathname = useRef(pathname)

  // Move focus to <main> on route change so keyboard/screen-reader users land
  // on the new content; skipped on initial mount so load doesn't steal focus.
  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    mainRef.current?.focus()
  }, [pathname])

  return (
    <div className="min-h-svh bg-surface text-ink flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-panel focus:text-ink focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>
      {focusMode && (
        <button
          type="button"
          onClick={toggleFocusMode}
          className="fixed top-2 right-2 z-40 rounded bg-panel px-3 py-1 font-ui text-sm text-ink-muted hover:text-ink"
        >
          Exit focus mode
        </button>
      )}
      {!focusMode && <TopNav />}
      <main ref={mainRef} id="main-content" tabIndex={-1} className="flex-1 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
      <CommandPalette focusModeActive={focusMode} onToggleFocusMode={toggleFocusMode} />
    </div>
  )
}

export default AppShell
