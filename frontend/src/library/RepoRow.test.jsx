import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { patchRepo } from '../api.js'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import RepoRow from './RepoRow.jsx'

vi.mock('../lib/useIngestStatus.js', () => ({ useIngestStatus: vi.fn() }))
vi.mock('../api.js', () => ({ patchRepo: vi.fn() }))

const repo = { repo: 'owner/repo', indexed_units: 42 }

function mockStatus(repoState) {
  useIngestStatus.mockReturnValue({
    status: { active: repoState != null, repos: repoState ? [repoState] : [] },
    refetch: vi.fn(),
  })
}

describe('RepoRow', () => {
  it('renders the repo name and indexed-unit count when idle', () => {
    mockStatus(null)
    render(<RepoRow repo={repo} />)

    expect(screen.getByText('owner/repo')).toBeInTheDocument()
    expect(screen.getByText('42 decisions')).toBeInTheDocument()
  })

  it('uses the singular "decision" for a count of exactly 1', () => {
    mockStatus(null)
    render(<RepoRow repo={{ repo: 'owner/repo', indexed_units: 1 }} />)

    expect(screen.getByText('1 decision')).toBeInTheDocument()
  })

  it('renders IndexProgress instead of the static count while the repo has an active job', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'fetching',
      counts: { fetched: 5, extracted: 0, skipped: 0, stored: 0 },
    })
    render(<RepoRow repo={repo} />)

    expect(screen.getByText('Reading commits — 5 examined')).toBeInTheDocument()
    expect(screen.queryByText('42 decisions')).not.toBeInTheDocument()
  })

  it('shows a zero-decision explanation instead of a bare "0 decisions" when idle', () => {
    mockStatus(null)
    render(<RepoRow repo={{ repo: 'owner/repo', indexed_units: 0 }} />)

    expect(screen.getByText(/No decisions extracted yet/)).toBeInTheDocument()
    expect(screen.queryByText('0 decisions')).not.toBeInTheDocument()
  })

  it('shows the live IndexProgress line, not the zero-decision explanation, while still indexing', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'fetching',
      counts: { fetched: 5, extracted: 0, skipped: 0, stored: 0 },
    })
    render(<RepoRow repo={{ repo: 'owner/repo', indexed_units: 0 }} />)

    expect(screen.getByText('Reading commits — 5 examined')).toBeInTheDocument()
    expect(screen.queryByText(/No decisions extracted yet/)).not.toBeInTheDocument()
  })

  it('falls back to the static count once the repo job is done', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'done',
      counts: { fetched: 5, extracted: 5, skipped: 0, stored: 5 },
    })
    render(<RepoRow repo={repo} />)

    expect(screen.getByText('42 decisions')).toBeInTheDocument()
  })

  it('falls back to the static count when the repo job failed', () => {
    mockStatus({
      repo: 'owner/repo',
      phase: 'failed',
      counts: { fetched: 5, extracted: 0, skipped: 0, stored: 0 },
      error: 'GitHub rate limited',
    })
    render(<RepoRow repo={repo} />)

    expect(screen.getByText('42 decisions')).toBeInTheDocument()
  })

  it('ignores active jobs for other repos', () => {
    mockStatus({
      repo: 'owner/other-repo',
      phase: 'fetching',
      counts: { fetched: 5, extracted: 0, skipped: 0, stored: 0 },
    })
    render(<RepoRow repo={repo} />)

    expect(screen.getByText('42 decisions')).toBeInTheDocument()
  })

  it('shows an inline confirmation before removing, and calls onRemove on confirm', async () => {
    mockStatus(null)
    const onRemove = vi.fn().mockResolvedValue()
    render(<RepoRow repo={repo} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByText(/Remove owner\/repo and its 42 indexed decisions\?/)).toBeInTheDocument()
    expect(onRemove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledWith('owner/repo')
  })

  it('cancel dismisses the confirmation without calling onRemove', () => {
    mockStatus(null)
    const onRemove = vi.fn()
    render(<RepoRow repo={repo} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText(/Remove owner\/repo/)).not.toBeInTheDocument()
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('shows an inline error and stays confirmable when onRemove fails', async () => {
    mockStatus(null)
    const onRemove = vi.fn().mockRejectedValue(new Error('network error'))
    render(<RepoRow repo={repo} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't remove this repo.")
  })

  it('calls onReindex with the repo name when Re-index is clicked', async () => {
    mockStatus(null)
    const onReindex = vi.fn().mockResolvedValue()
    render(<RepoRow repo={repo} onReindex={onReindex} />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-index' }))

    expect(onReindex).toHaveBeenCalledWith('owner/repo')
  })

  it('shows an inline error when onReindex fails', async () => {
    mockStatus(null)
    const onReindex = vi.fn().mockRejectedValue(new Error('network error'))
    render(<RepoRow repo={repo} onReindex={onReindex} />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-index' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't start re-indexing.")
  })

  it('reflects the initial cloud_synthesis_allowed value on render', () => {
    mockStatus(null)
    render(<RepoRow repo={{ ...repo, cloud_synthesis_allowed: false }} />)

    expect(screen.getByRole('switch', { name: 'Cloud synthesis: off' })).toBeInTheDocument()
  })

  it('defaults the toggle to on when cloud_synthesis_allowed is absent', () => {
    mockStatus(null)
    render(<RepoRow repo={repo} />)

    expect(screen.getByRole('switch', { name: 'Cloud synthesis: on' })).toBeInTheDocument()
  })

  it('toggling calls PATCH /repos/{repo} with the flipped value', async () => {
    mockStatus(null)
    patchRepo.mockResolvedValue({})
    render(<RepoRow repo={{ ...repo, cloud_synthesis_allowed: true }} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Cloud synthesis: on' }))

    expect(patchRepo).toHaveBeenCalledWith('owner/repo', { cloud_synthesis_allowed: false })
    expect(await screen.findByRole('switch', { name: 'Cloud synthesis: off' })).toBeInTheDocument()
  })

  it('reverts the toggle and shows an inline error when the PATCH fails', async () => {
    mockStatus(null)
    patchRepo.mockRejectedValue(new Error('network error'))
    render(<RepoRow repo={{ ...repo, cloud_synthesis_allowed: true }} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Cloud synthesis: on' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update cloud synthesis setting.")
    expect(screen.getByRole('switch', { name: 'Cloud synthesis: on' })).toBeInTheDocument()
  })
})
