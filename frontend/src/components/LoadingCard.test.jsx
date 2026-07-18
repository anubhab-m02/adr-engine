import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoadingCard from './LoadingCard.jsx'

describe('LoadingCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an initial status message', () => {
    render(<LoadingCard />)
    expect(screen.getByText('Searching decision history…')).toBeInTheDocument()
  })

  it('rotates the status text over time', () => {
    render(<LoadingCard />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Reading citations…')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Synthesizing an answer…')).toBeInTheDocument()
  })
})
