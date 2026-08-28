import { useCallback, useState } from 'react'

const STORAGE_KEY = 'readingPreferences'

const DEFAULTS = { density: 'comfortable' }

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
// key.
function useReadingPreferences() {
  const [preferences, setPreferences] = useState(readStored)

  const update = useCallback((patch) => {
    setPreferences((current) => {
      const next = { ...current, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setDensity = useCallback((density) => update({ density }), [update])

  return { ...preferences, setDensity }
}

export default useReadingPreferences
