import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { postIngest } from '../api.js'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import IndexStep from './IndexStep.jsx'

vi.mock('../api.js', () => ({ postIngest: vi.fn() }))
vi.mock('../lib/useIngestStatus.js', () => ({ useIngestStatus: vi.fn() }))

function mockStatus(status) {
  useIngestStatus.mockReturnValue({ status, refetch: vi.fn() })
}

describe('IndexStep', () => {
  it('triggers POST /ingest on mount', () => {
    postIngest.mockResolvedValue({ job_id: 'abc' })
    mockStatus(null)

    render(<IndexStep repos={['owner/repo-a']} onComplete={vi.fn()} />)

    expect(postIngest).toHaveBeenCalledTimes(1)
  })

  it('renders IndexProgress for each chosen repo', () => {
    postIngest.mockResolvedValue({ job_id: 'abc' })
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 10, extracted: 0, skipped: 0, stored: 0 } }],
    })

    render(<IndexStep repos={['owner/repo-a']} onComplete={vi.fn()} />)

    expect(screen.getByText('Reading commits — 10 examined')).toBeInTheDocument()
  })

  it('advances once the job finishes with no failures', () => {
    postIngest.mockResolvedValue({ job_id: 'abc' })
    const onComplete = vi.fn()
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 10, extracted: 0, skipped: 0, stored: 0 } }],
    })

    const { rerender } = render(<IndexStep repos={['owner/repo-a']} onComplete={onComplete} />)
    expect(onComplete).not.toHaveBeenCalled()

    mockStatus({
      active: false,
      repos: [{ repo: 'owner/repo-a', phase: 'done', counts: { fetched: 10, extracted: 10, skipped: 0, stored: 10 } }],
    })
    rerender(<IndexStep repos={['owner/repo-a']} onComplete={onComplete} />)

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('does not advance if a repo failed', () => {
    postIngest.mockResolvedValue({ job_id: 'abc' })
    const onComplete = vi.fn()
    mockStatus({
      active: true,
      repos: [{ repo: 'owner/repo-a', phase: 'fetching', counts: { fetched: 10, extracted: 0, skipped: 0, stored: 0 } }],
    })

    const { rerender } = render(<IndexStep repos={['owner/repo-a']} onComplete={onComplete} />)

    mockStatus({
      active: false,
      repos: [
        { repo: 'owner/repo-a', phase: 'failed', counts: { fetched: 10, extracted: 0, skipped: 0, stored: 0 }, error: 'boom' },
      ],
    })
    rerender(<IndexStep repos={['owner/repo-a']} onComplete={onComplete} />)

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('does not advance when the job never reported active before going idle', () => {
    postIngest.mockResolvedValue({ job_id: 'abc' })
    const onComplete = vi.fn()
    mockStatus({ active: false, repos: [] })

    render(<IndexStep repos={['owner/repo-a']} onComplete={onComplete} />)

    expect(onComplete).not.toHaveBeenCalled()
  })
})
