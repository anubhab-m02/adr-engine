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

  it('includes a relative time string in the done label when indexed_at is known', () => {
    mockStatus({ repo: 'owner/repo', phase: 'done', counts: { fetched: 214, extracted: 37, skipped: 5, stored: 37 } })
    const indexedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    render(<IndexProgress repo="owner/repo" indexedAt={indexedAt} />)
    expect(screen.getByText('Indexed 37 decisions · indexed 2 days ago')).toBeInTheDocument()
  })

  it('falls back to the count-only done label when indexed_at is null', () => {
    mockStatus({ repo: 'owner/repo', phase: 'done', counts: { fetched: 214, extracted: 37, skipped: 5, stored: 37 } })
    render(<IndexProgress repo="owner/repo" indexedAt={null} />)
    expect(screen.getByText('Indexed 37 decisions')).toBeInTheDocument()
  })

  it('appends a stale marker when indexed_at is more than 30 days ago', () => {
    mockStatus({ repo: 'owner/repo', phase: 'done', counts: { fetched: 214, extracted: 37, skipped: 5, stored: 37 } })
    const indexedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    render(<IndexProgress repo="owner/repo" indexedAt={indexedAt} />)
    expect(screen.getByText('Indexed 37 decisions · indexed last month · consider re-indexing')).toBeInTheDocument()
  })

  it('does not append a stale marker when indexed_at is under 30 days ago', () => {
    mockStatus({ repo: 'owner/repo', phase: 'done', counts: { fetched: 214, extracted: 37, skipped: 5, stored: 37 } })
    const indexedAt = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()
    render(<IndexProgress repo="owner/repo" indexedAt={indexedAt} />)
    expect(screen.getByText('Indexed 37 decisions · indexed 4 weeks ago')).toBeInTheDocument()
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

  it('exposes the extracting bar as a progressbar with a name and value', () => {
    mockStatus({ repo: 'owner/repo', phase: 'extracting', counts: { fetched: 10, extracted: 5, skipped: 0, stored: 0 } })
    render(<IndexProgress repo="owner/repo" />)
    const bar = screen.getByRole('progressbar', { name: 'Extraction progress for owner/repo' })
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })

  it('reports aria-valuenow 0 when nothing has been fetched', () => {
    mockStatus({ repo: 'owner/repo', phase: 'extracting', counts: { fetched: 0, extracted: 0, skipped: 0, stored: 0 } })
    render(<IndexProgress repo="owner/repo" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it.each(['queued', 'fetching', 'embedding', 'done', 'failed'])('has no progressbar in the %s phase', (phase) => {
    mockStatus({ repo: 'owner/repo', phase, counts: { fetched: 10, extracted: 5, skipped: 0, stored: 5 }, error: 'x' })
    render(<IndexProgress repo="owner/repo" />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
