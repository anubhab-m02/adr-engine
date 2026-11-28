import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'bookmarks'

function isEntry(value) {
  return value && typeof value === 'object' && typeof value.url === 'string'
}

function parse(raw) {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

// Module-level store shared by every hook instance, so several mounted
// SourceCards (or a BookmarksList) always agree. The snapshot is cached against
// the raw stored string: it only re-parses (and changes identity) when
// localStorage actually changed, which also picks up other tabs via `storage`.
const listeners = new Set()
let cachedRaw
let cachedList = []

function getSnapshot() {
  let raw = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: keep serving the in-memory list.
    return cachedList
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedList = parse(raw)
  }
  return cachedList
}

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  const onStorage = (event) => {
    if (event.key === null || event.key === STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function toggleBookmark({ url, title }) {
  const current = getSnapshot()
  const next = current.some((b) => b.url === url)
    ? current.filter((b) => b.url !== url)
    : [...current, { url, title, savedAt: new Date().toISOString() }]
  try {
    const raw = JSON.stringify(next)
    localStorage.setItem(STORAGE_KEY, raw)
    cachedRaw = raw
  } catch {
    // Storage full/unavailable: keep the in-memory state for this session.
  }
  cachedList = next
  notify()
}

// Saved decisions, keyed by decision (commit/PR) URL. Local-first: lives in
// localStorage only, no backend. Corrupt or missing stored JSON falls back to
// an empty list rather than throwing.
function useBookmarks() {
  const bookmarks = useSyncExternalStore(subscribe, getSnapshot)

  const isBookmarked = useCallback((url) => bookmarks.some((b) => b.url === url), [bookmarks])
  const list = useCallback(() => bookmarks, [bookmarks])

  return { toggle: toggleBookmark, isBookmarked, list }
}

export default useBookmarks
