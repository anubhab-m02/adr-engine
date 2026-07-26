import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CitationMarker from './CitationMarker.jsx'

describe('CitationMarker', () => {
  afterEach(() => {
    document.body.innerHTML = ''
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
