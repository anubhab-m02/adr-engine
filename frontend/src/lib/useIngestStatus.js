// The single context-shared poller for GET /ingest/status. Per
// ARCHITECTURE.md's binding rule, there is never more than one active
// status poller — Onboarding's IndexStep, Library's rows, and the
// shell's StatusPill all consume this one hook instead of each mounting
// their own interval.
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getIngestStatus } from '../api.js'

const POLL_INTERVAL_MS = 2000

const IngestStatusContext = createContext(null)

export function IngestStatusProvider({ children }) {
  const [status, setStatus] = useState(null)
  const timerRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    const result = await getIngestStatus()
    setStatus(result)
    return result
  }, [])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      const result = await fetchStatus()
      if (!cancelled && result.active) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [fetchStatus])

  return createElement(IngestStatusContext.Provider, { value: { status, refetch: fetchStatus } }, children)
}

export function useIngestStatus() {
  const context = useContext(IngestStatusContext)
  if (!context) {
    throw new Error('useIngestStatus must be used within an IngestStatusProvider')
  }
  return context
}
