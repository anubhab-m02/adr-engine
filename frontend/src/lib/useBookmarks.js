import { useCallback, useState } from 'react'

const STORAGE_KEY = 'bookmarks'

function isEntry(value) {
  return value && typeof value === 'object' && typeof value.url === 'string'
}

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

// Saved decisions, keyed by decision (commit/PR) URL. Local-first: lives in
// localStorage only, no backend. Corrupt or missing stored JSON falls back to
// an empty list rather than throwing.
function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(readStored)

  const toggle = useCallback(({ url, title }) => {
    setBookmarks((current) => {
      const next = current.some((b) => b.url === url)
        ? current.filter((b) => b.url !== url)
        : [...current, { url, title, savedAt: new Date().toISOString() }]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage full/unavailable: keep the in-memory state for this session.
      }
      return next
    })
  }, [])

  const isBookmarked = useCallback((url) => bookmarks.some((b) => b.url === url), [bookmarks])
  const list = useCallback(() => bookmarks, [bookmarks])

  return { toggle, isBookmarked, list }
}

export default useBookmarks
