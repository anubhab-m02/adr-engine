import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import IndexProgress from './IndexProgress.jsx'

vi.mock('../lib/useIngestStatus.js', () => ({ useIngestStatus: vi.fn() }))

function mockStatus(repoState) {
  useIngestStatus.mockReturnValue({
    status: { active: true, repos: repoState ? [repoState] : [] },
    refetch: vi.fn(),
  })
}

describe('IndexProgress', () => {
  it('renders nothing when the status has no entry for this repo', () => {
    mockStatus(null)
    const { container } = render(<IndexProgress repo="owner/repo" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the status hook has no data yet', () => {
    useIngestStatus.mockReturnValue({ status: null, refetch: vi.fn() })
    const { container } = render(<IndexProgress repo="owner/repo" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the queued state', () => {
    mockStatus({ repo: 'owner/repo', phase: 'queued', counts: { fetched: 0, extracted: 0, skipped: 0, stored: 0 } })
    render(<IndexProgress repo="owner/repo" />)
    expect(screen.getByText('Queued…')).toBeInTheDocument()
  })

  it('renders the fetching state with live counts', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'fetching',
      counts: { fetched: 214, extracted: 0, skipped: 0, stored: 0 },
    })
    render(<IndexProgress repo="owner/repo" />)
    expect(screen.getByText('Reading commits — 214 examined')).toBeInTheDocument()
  })

  it('renders the extracting state with a progress bar', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'extracting',
      counts: { fetched: 214, extracted: 37, skipped: 0, stored: 0 },
    })
    const { container } = render(<IndexProgress repo="owner/repo" />)
    expect(screen.getByText('Extracting decisions — 37 recorded of 214')).toBeInTheDocument()
    const fill = container.querySelector('.bg-accent')
    expect(fill).toHaveStyle({ width: `${(37 / 214) * 100}%` })
  })

  it('renders the embedding state', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'embedding',
      counts: { fetched: 214, extracted: 37, skipped: 0, stored: 0 },
    })
    render(<IndexProgress repo="owner/repo" />)
    expect(screen.getByText('Embedding 37 decisions…')).toBeInTheDocument()
  })

  it('renders the done state', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'done',
      counts: { fetched: 214, extracted: 37, skipped: 5, stored: 37 },
    })
    render(<IndexProgress repo="owner/repo" />)
    expect(screen.getByText('Indexed 37 decisions')).toBeInTheDocument()
  })

  it('renders the failed state with the server error message', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'failed',
      counts: { fetched: 0, extracted: 0, skipped: 0, stored: 0 },
      error: 'GitHub rate limited',
    })
    render(<IndexProgress repo="owner/repo" />)
    expect(screen.getByText('GitHub rate limited')).toBeInTheDocument()
  })
})
