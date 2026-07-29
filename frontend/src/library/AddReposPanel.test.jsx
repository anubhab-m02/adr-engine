import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGithubRepos, patchConfig, postIngest } from '../api.js'
import AddReposPanel from './AddReposPanel.jsx'

vi.mock('../api.js', () => ({ getGithubRepos: vi.fn(), patchConfig: vi.fn(), postIngest: vi.fn() }))

const repos = [
  { name: 'owner/repo-a', private: false, commit_count_estimate: 42 },
  { name: 'owner/repo-b', private: false, commit_count_estimate: 5 },
  { name: 'owner/already-indexed', private: false, commit_count_estimate: 10 },
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

describe('AddReposPanel', () => {
  it('excludes already-indexed repos from the pickable list', async () => {
    getGithubRepos.mockResolvedValue({ repos })
    render(<AddReposPanel indexedRepos={['owner/already-indexed']} onDone={vi.fn()} onCancel={vi.fn()} />)

    await flush()

    expect(screen.getByText('owner/repo-a')).toBeInTheDocument()
    expect(screen.queryByText('owner/already-indexed')).not.toBeInTheDocument()
  })

  it('submits: PATCH /config with the expanded list, then POST /ingest with only the new repos', async () => {
    getGithubRepos.mockResolvedValue({ repos })
    patchConfig.mockResolvedValue({})
    postIngest.mockResolvedValue({})
    const onDone = vi.fn()

    render(<AddReposPanel indexedRepos={['owner/already-indexed']} onDone={onDone} onCancel={vi.fn()} />)
    await flush()

    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: /^Index/ }))
    await flush()

    expect(patchConfig).toHaveBeenCalledWith({ indexed_repos: ['owner/already-indexed', 'owner/repo-a'] })
    expect(postIngest).toHaveBeenCalledWith({ repos: ['owner/repo-a'] })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cancel calls onCancel without calling the API', async () => {
    getGithubRepos.mockResolvedValue({ repos })
    const onCancel = vi.fn()
    render(<AddReposPanel indexedRepos={[]} onDone={vi.fn()} onCancel={onCancel} />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(patchConfig).not.toHaveBeenCalled()
  })
})
