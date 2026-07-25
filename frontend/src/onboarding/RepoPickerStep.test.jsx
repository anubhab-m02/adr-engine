import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGithubRepos, patchConfig } from '../api.js'
import RepoPickerStep from './RepoPickerStep.jsx'

vi.mock('../api.js', () => ({ getGithubRepos: vi.fn(), patchConfig: vi.fn() }))

const repos = [
  { name: 'owner/repo-a', private: false, commit_count_estimate: 42 },
  { name: 'owner/repo-b', private: true, commit_count_estimate: 5 },
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
  })
}

describe('RepoPickerStep', () => {
  it('fetches and renders repos on mount', async () => {
    getGithubRepos.mockResolvedValue({ repos })
    render(<RepoPickerStep onNext={vi.fn()} />)

    await flush()

    expect(getGithubRepos).toHaveBeenCalledWith({})
    expect(screen.getByText('owner/repo-a')).toBeInTheDocument()
    expect(screen.getByText('owner/repo-b')).toBeInTheDocument()
  })

  it('renders the empty state when the fetch returns no repos', async () => {
    getGithubRepos.mockResolvedValue({ repos: [] })
    render(<RepoPickerStep onNext={vi.fn()} />)

    await flush()

    expect(screen.getByText('No repos found for this account.')).toBeInTheDocument()
  })

  it('toggles selection per row and submits the selected repos via PATCH /config', async () => {
    getGithubRepos.mockResolvedValue({ repos })
    patchConfig.mockResolvedValue({})
    const onNext = vi.fn()
    render(<RepoPickerStep onNext={onNext} />)

    await flush()

    const continueButton = screen.getByRole('button', { name: /^Index/ })
    expect(continueButton).toBeDisabled()

    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(continueButton).toBeEnabled()
    expect(continueButton).toHaveTextContent('Index 1 repo')

    fireEvent.click(continueButton)
    await flush()

    expect(patchConfig).toHaveBeenCalledWith({ indexed_repos: ['owner/repo-a'] })
    expect(onNext).toHaveBeenCalledWith(['owner/repo-a'])
  })

  it('debounces the search query before re-fetching', async () => {
    getGithubRepos.mockResolvedValue({ repos })
    render(<RepoPickerStep onNext={vi.fn()} />)
    await flush()
    getGithubRepos.mockClear()

    fireEvent.change(screen.getByLabelText('Search repos'), { target: { value: 'repo-a' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(getGithubRepos).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(getGithubRepos).toHaveBeenCalledWith({ query: 'repo-a' })
  })
})
