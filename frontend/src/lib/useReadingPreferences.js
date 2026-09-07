import { useCallback, useState } from 'react'

const STORAGE_KEY = 'readingPreferences'

const DEFAULTS = { density: 'comfortable', measure: 'default', focusMode: false }

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

// Track B's reading-column preferences: disposable client-only display
// settings (unlike bookmarks/annotations, losing these costs nothing), so
// localStorage is enough. Stored as one object under one key so each
// preference shares persistence logic instead of growing its own storage
// key. Focus mode joins density/measure here (rather than resetting per
// navigation) so all three reading preferences behave the same way.
function useReadingPreferences() {
  const [preferences, setPreferences] = useState(readStored)

  const update = useCallback((patch) => {
    setPreferences((current) => {
      const partial = typeof patch === 'function' ? patch(current) : patch
      const next = { ...current, ...partial }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setDensity = useCallback((density) => update({ density }), [update])
  const setMeasure = useCallback((measure) => update({ measure }), [update])
  const toggleFocusMode = useCallback(
    () => update((current) => ({ focusMode: !current.focusMode })),
    [update],
  )

  return { ...preferences, setDensity, setMeasure, toggleFocusMode }
}

export default useReadingPreferences
