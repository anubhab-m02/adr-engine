import { useCallback, useState } from 'react'

const STORAGE_KEY = 'annotations'

function isEntry(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.url === 'string' &&
    typeof value.note === 'string'
  )
}

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

function persist(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full/unavailable: keep the in-memory state for this session.
  }
}

// Local-only notes keyed by decision (commit/PR) URL, stored as
// `{url, note, updatedAt}` entries under a single localStorage key. Missing or
// corrupt stored JSON falls back to empty rather than throwing.
function useAnnotations() {
  const [entries, setEntries] = useState(readStored)

  const update = useCallback((fn) => {
    setEntries((current) => {
      const next = fn(current)
      persist(next)
      return next
    })
  }, [])

  const remove = useCallback((url) => update((current) => current.filter((e) => e.url !== url)), [update])

  const set = useCallback(
    (url, note) => {
      if (!note || !note.trim()) {
        remove(url)
        return
      }
      const entry = { url, note, updatedAt: new Date().toISOString() }
      update((current) => [...current.filter((e) => e.url !== url), entry])
    },
    [remove, update],
  )

  const get = useCallback((url) => entries.find((e) => e.url === url), [entries])

  return { get, set, remove }
}

export default useAnnotations
