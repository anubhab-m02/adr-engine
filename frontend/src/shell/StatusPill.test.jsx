import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import StatusPill from './StatusPill.jsx'

vi.mock('../lib/useIngestStatus.js', () => ({ useIngestStatus: vi.fn() }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function mockStatus(status) {
  useIngestStatus.mockReturnValue({ status, refetch: vi.fn() })
}

function renderPill() {
  return render(<StatusPill />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  vi.useFakeTimers()
  navigateMock.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StatusPill', () => {
  it('renders nothing when the status hook has no data yet', () => {
    mockStatus(null)
    const { container } = renderPill()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when idle', () => {
    mockStatus({ active: false, repos: [] })
    const { container } = renderPill()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders progress text for a single repo in progress', () => {
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 10, extracted: 0, skipped: 0, stored: 0 } }],
    })
    renderPill()
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
    renderPill()
    expect(screen.getByRole('status')).toHaveTextContent('Indexing 2 repos…')
  })

  it('renders an error affordance when any repo has failed', () => {
    mockStatus({
      active: false,
      repos: [
        { repo: 'owner/repo-a', phase: 'failed', counts: { fetched: 0, extracted: 0, skipped: 0, stored: 0 }, error: 'GitHub rate limited' },
      ],
    })
    renderPill()
    expect(screen.getByRole('status')).toHaveTextContent('Indexing failed')
  })

  it('navigates to /library on click', () => {
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 1, extracted: 0, skipped: 0, stored: 0 } }],
    })
    renderPill()

    fireEvent.click(screen.getByRole('status'))

    expect(navigateMock).toHaveBeenCalledWith('/library')
  })

  it('shows a completion state that fades out after a job finishes cleanly', () => {
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 1, extracted: 0, skipped: 0, stored: 0 } }],
    })
    const { rerender } = renderPill()

    mockStatus({
      active: false,
      repos: [{ repo: 'owner/repo-a', phase: 'done', counts: { fetched: 1, extracted: 1, skipped: 0, stored: 1 } }],
    })
    rerender(<StatusPill />)

    expect(screen.getByRole('status')).toHaveTextContent('✓ Indexed')

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not show a completion state when the job finished with a failure', () => {
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 1, extracted: 0, skipped: 0, stored: 0 } }],
    })
    const { rerender } = renderPill()

    mockStatus({
      active: false,
      repos: [{ repo: 'owner/repo-a', phase: 'failed', counts: { fetched: 1, extracted: 0, skipped: 0, stored: 0 }, error: 'boom' }],
    })
    rerender(<StatusPill />)

    expect(screen.getByRole('status')).toHaveTextContent('Indexing failed')
  })

  it('clears the failure indicator once clicked', () => {
    mockStatus({
      active: false,
      repos: [{ repo: 'owner/repo-a', phase: 'failed', counts: { fetched: 1, extracted: 0, skipped: 0, stored: 0 }, error: 'boom' }],
    })
    const { rerender } = renderPill()

    fireEvent.click(screen.getByRole('status'))
    rerender(<StatusPill />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
