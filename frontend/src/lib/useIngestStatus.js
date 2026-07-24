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
  const [error, setError] = useState(false)
  const timerRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    const result = await getIngestStatus()
    setStatus(result)
    setError(false)
    return result
  }, [])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      // A single failed request (network blip, backend restart) must not
      // kill the loop — without the catch, an unhandled rejection here
      // stops polling for good, since nothing re-schedules the timeout.
      let active = true
      try {
        active = (await fetchStatus()).active
      } catch {
        if (!cancelled) setError(true)
      }
      if (!cancelled && active !== false) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [fetchStatus])

  return createElement(IngestStatusContext.Provider, { value: { status, error, refetch: fetchStatus } }, children)
}

export function useIngestStatus() {
  const context = useContext(IngestStatusContext)
  if (!context) {
    throw new Error('useIngestStatus must be used within an IngestStatusProvider')
  }
  return context
}
