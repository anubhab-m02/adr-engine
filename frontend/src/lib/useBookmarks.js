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

// Shared store so every hook instance (one per SourceCard) sees the same
// list. Snapshots are re-derived from the raw stored string and cached by it,
// so the reference stays stable between changes and external edits are seen.
const listeners = new Set()
let lastRaw = null
let lastList = []
// In-memory fallback for the session when storage is unavailable/full.
let memoryOverride = null

function readRaw() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function getSnapshot() {
  if (memoryOverride) return memoryOverride
  const raw = readRaw()
  if (raw !== lastRaw) {
    lastRaw = raw
    lastList = parse(raw)
  }
  return lastList
}

function subscribe(listener) {
  listeners.add(listener)
  const onStorage = (e) => {
    if (e.key === null || e.key === STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function toggleBookmark({ url, title }) {
  // Always compute from the latest stored state, never a per-instance copy.
  const current = getSnapshot()
  const next = current.some((b) => b.url === url)
    ? current.filter((b) => b.url !== url)
    : [...current, { url, title, savedAt: new Date().toISOString() }]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    memoryOverride = null
  } catch {
    // Storage full/unavailable: keep the in-memory state for this session.
    memoryOverride = next
  }
  listeners.forEach((l) => l())
}

// Saved decisions, keyed by decision (commit/PR) URL. Local-first: lives in
// localStorage only, no backend. Corrupt or missing stored JSON falls back to
// an empty list rather than throwing. State is shared across all instances.
function useBookmarks() {
  const bookmarks = useSyncExternalStore(subscribe, getSnapshot)

  const toggle = useCallback((entry) => toggleBookmark(entry), [])
  const isBookmarked = useCallback((url) => bookmarks.some((b) => b.url === url), [bookmarks])
  const list = useCallback(() => bookmarks, [bookmarks])

  return { toggle, isBookmarked, list }
}

export default useBookmarks
