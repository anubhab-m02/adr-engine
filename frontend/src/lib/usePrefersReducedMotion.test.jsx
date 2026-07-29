import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import usePrefersReducedMotion from './usePrefersReducedMotion.js'

function Probe() {
  const reducedMotion = usePrefersReducedMotion()
  return <span>{reducedMotion ? 'reduced' : 'full'}</span>
}

function stubMatchMedia(matches) {
  const listeners = new Set()
  const mql = {
    matches,
    addEventListener: (_event, handler) => listeners.add(handler),
    removeEventListener: (_event, handler) => listeners.delete(handler),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return {
    mql,
    fire(nextMatches) {
      mql.matches = nextMatches
      listeners.forEach((handler) => handler({ matches: nextMatches }))
    },
  }
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    delete window.matchMedia
  })

  it('returns false when the environment has no matchMedia support', () => {
    delete window.matchMedia
    render(<Probe />)
    expect(screen.getByText('full')).toBeInTheDocument()
  })

  it('reflects an initial reduced-motion preference', () => {
    stubMatchMedia(true)
    render(<Probe />)
    expect(screen.getByText('reduced')).toBeInTheDocument()
  })

  it('reflects an initial no-preference (full motion)', () => {
    stubMatchMedia(false)
    render(<Probe />)
    expect(screen.getByText('full')).toBeInTheDocument()
  })

  it('updates when the media query change fires', () => {
    const { fire } = stubMatchMedia(false)
    render(<Probe />)
    expect(screen.getByText('full')).toBeInTheDocument()

    act(() => {
      fire(true)
    })
    expect(screen.getByText('reduced')).toBeInTheDocument()
  })
})
