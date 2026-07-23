import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import StatusPill from './StatusPill.jsx'

vi.mock('../lib/useIngestStatus.js', () => ({ useIngestStatus: vi.fn() }))

function mockStatus(status) {
  useIngestStatus.mockReturnValue({ status, refetch: vi.fn() })
}

describe('StatusPill', () => {
  it('renders nothing when the status hook has no data yet', () => {
    mockStatus(null)
    const { container } = render(<StatusPill />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when idle', () => {
    mockStatus({ active: false, repos: [] })
    const { container } = render(<StatusPill />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders progress text for a single repo in progress', () => {
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 10, extracted: 0, skipped: 0, stored: 0 } }],
    })
    render(<StatusPill />)
    expect(screen.getByRole('status')).toHaveTextContent('Indexing owner/repo-a…')
  })

  it('renders a repo count when more than one repo is in progress', () => {
    mockStatus({
      active: true,
      repos: [
        { repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 10, extracted: 0, skipped: 0, stored: 0 } },
        { repo: 'owner/repo-b', phase: 'queued', counts: { fetched: 0, extracted: 0, skipped: 0, stored: 0 } },
      ],
    })
    render(<StatusPill />)
    expect(screen.getByRole('status')).toHaveTextContent('Indexing 2 repos…')
  })

  it('renders an error affordance when any repo has failed', () => {
    mockStatus({
      active: false,
      repos: [
        { repo: 'owner/repo-a', phase: 'failed', counts: { fetched: 0, extracted: 0, skipped: 0, stored: 0 }, error: 'GitHub rate limited' },
      ],
    })
    render(<StatusPill />)
    expect(screen.getByRole('status')).toHaveTextContent('Indexing failed')
  })
})
