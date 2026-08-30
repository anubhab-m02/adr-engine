import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRepos, patchConfig, postIngest } from '../api.js'
import { useIngestStatus } from '../lib/useIngestStatus.js'
import LibraryPage from './LibraryPage.jsx'

vi.mock('../api.js', () => ({ getRepos: vi.fn(), patchConfig: vi.fn(), getGithubRepos: vi.fn(), postIngest: vi.fn() }))
vi.mock('../lib/useIngestStatus.js', () => ({ useIngestStatus: vi.fn() }))

const REPOS = {
  repos: [
    { repo: 'owner/repo-a', indexed_units: 12 },
    { repo: 'owner/repo-b', indexed_units: 0 },
  ],
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('LibraryPage', () => {
  it('renders one row per repo from GET /repos', async () => {
    getRepos.mockResolvedValue(REPOS)
    useIngestStatus.mockReturnValue({ status: { active: false, repos: [] }, refetch: vi.fn() })

    render(<LibraryPage />)

    expect(await screen.findByText('owner/repo-a')).toBeInTheDocument()
    expect(screen.getByText('12 decisions')).toBeInTheDocument()
    expect(screen.getByText('owner/repo-b')).toBeInTheDocument()
    expect(screen.getByText(/No decisions extracted yet/)).toBeInTheDocument()
  })

  it('shows the empty-library prompt when there are no repos', async () => {
    getRepos.mockResolvedValue({ repos: [] })
    useIngestStatus.mockReturnValue({ status: { active: false, repos: [] }, refetch: vi.fn() })

    render(<LibraryPage />)

    expect(await screen.findByText('Nothing in the library yet.')).toBeInTheDocument()
  })

  it('shows an error message when GET /repos fails', async () => {
    getRepos.mockRejectedValue(new Error('network error'))
    useIngestStatus.mockReturnValue({ status: { active: false, repos: [] }, refetch: vi.fn() })

    render(<LibraryPage />)

    expect(await screen.findByText("Couldn't load the library.")).toBeInTheDocument()
  })

  it('shows a row with live IndexProgress when that repo has an active job', async () => {
    getRepos.mockResolvedValue(REPOS)
    useIngestStatus.mockReturnValue({
      status: {
        active: true,
        repos: [{ repo: 'owner/repo-a', phase: 'embedding', counts: { fetched: 12, extracted: 12, skipped: 0, stored: 0 } }],
      },
      refetch: vi.fn(),
    })

    render(<LibraryPage />)

    expect(await screen.findByText('Embedding 12 decisions…')).toBeInTheDocument()
    expect(screen.getByText(/No decisions extracted yet/)).toBeInTheDocument()
  })

  it('opens the AddReposPanel from the Add repos button', async () => {
    getRepos.mockResolvedValue(REPOS)
    useIngestStatus.mockReturnValue({ status: { active: false, repos: [] }, refetch: vi.fn() })

    render(<LibraryPage />)
    await screen.findByText('owner/repo-a')

    expect(screen.queryByRole('heading', { name: 'Add repos' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add repos' }))
    expect(screen.getByRole('heading', { name: 'Add repos' })).toBeInTheDocument()
  })

  it('removing a repo calls PATCH /config with that repo excluded and drops its row', async () => {
    getRepos.mockResolvedValue(REPOS)
    patchConfig.mockResolvedValue({})
    useIngestStatus.mockReturnValue({ status: { active: false, repos: [] }, refetch: vi.fn() })

    render(<LibraryPage />)
    await screen.findByText('owner/repo-a')

    const [removeA] = screen.getAllByRole('button', { name: 'Remove' })
    fireEvent.click(removeA)
    const [confirmA] = screen.getAllByRole('button', { name: 'Remove' })
    fireEvent.click(confirmA)
    await screen.findByRole('button', { name: 'Remove' })

    expect(patchConfig).toHaveBeenCalledWith({ indexed_repos: ['owner/repo-b'] })
    expect(screen.queryByText('owner/repo-a')).not.toBeInTheDocument()
    expect(screen.getByText('owner/repo-b')).toBeInTheDocument()
  })

  it('re-indexing a repo calls POST /ingest with that repo and refreshes the list', async () => {
    getRepos.mockResolvedValue(REPOS)
    postIngest.mockResolvedValue({})
    useIngestStatus.mockReturnValue({ status: { active: false, repos: [] }, refetch: vi.fn() })

    render(<LibraryPage />)
    await screen.findByText('owner/repo-a')

    const [reindexA] = screen.getAllByRole('button', { name: 'Re-index' })
    fireEvent.click(reindexA)

    await vi.waitFor(() => expect(postIngest).toHaveBeenCalledWith({ repos: ['owner/repo-a'] }))
    expect(getRepos).toHaveBeenCalledTimes(2)
  })
})
