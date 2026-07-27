import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CitationMarker from './CitationMarker.jsx'

function stubMatchMedia(matches) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

describe('CitationMarker', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.matchMedia
  })

  it('applies the ink-in animation and a stagger delay by default', () => {
    stubMatchMedia(false)
    render(<CitationMarker number={3} unitId="abc123" />)

    const link = screen.getByRole('link', { name: 'Jump to source 3' })
    expect(link).toHaveClass('animate-citation-ink-in')
    expect(link.style.animationDelay).toBe('calc(var(--dur-surface) + 300ms)')
  })

  it('renders instantly with no animation class or delay when reduced motion is preferred', () => {
    stubMatchMedia(true)
    render(<CitationMarker number={3} unitId="abc123" />)

    const link = screen.getByRole('link', { name: 'Jump to source 3' })
    expect(link).not.toHaveClass('animate-citation-ink-in')
    expect(link.style.animationDelay).toBe('')
  })

  it('renders the marker number', () => {
    render(<CitationMarker number={2} unitId="abc123" />)

    expect(screen.getByRole('link', { name: 'Jump to source 2' })).toHaveTextContent('2')
  })

  it('links to the fragment matching its source card id', () => {
    render(<CitationMarker number={1} unitId="abc123" />)

    expect(screen.getByRole('link', { name: 'Jump to source 1' })).toHaveAttribute('href', '#source-abc123')
  })

  it('clicking scrolls the matching source into view', () => {
    render(<CitationMarker number={1} unitId="abc123" />)

    const source = document.createElement('div')
    source.id = 'source-abc123'
    source.scrollIntoView = vi.fn()
    document.body.appendChild(source)

    fireEvent.click(screen.getByRole('link', { name: 'Jump to source 1' }))

    expect(source.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
  })
})
