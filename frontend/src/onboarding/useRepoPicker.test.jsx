import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGithubRepos } from '../api.js'
import useRepoPicker from './useRepoPicker.js'

vi.mock('../api.js', () => ({ getGithubRepos: vi.fn() }))

const repoList = (...names) => ({ repos: names.map((name) => ({ name })) })

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  getGithubRepos.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRepoPicker', () => {
  it('fetches immediately for an empty query', async () => {
    getGithubRepos.mockResolvedValue(repoList('a/one'))
    const { result } = renderHook(() => useRepoPicker())
    expect(result.current.repos).toBeUndefined()

    await advance(0)

    expect(getGithubRepos).toHaveBeenCalledWith({})
    expect(result.current.repos).toEqual([{ name: 'a/one' }])
  })

  it('debounces a non-empty query by 300ms and ignores a superseded result', async () => {
    getGithubRepos.mockResolvedValue(repoList('a/one'))
    const { result } = renderHook(() => useRepoPicker())
    await advance(0)
    getGithubRepos.mockClear()

    act(() => result.current.setQuery('fo'))
    await advance(299)
    expect(getGithubRepos).not.toHaveBeenCalled()

    // A newer query supersedes the pending one before it fires.
    act(() => result.current.setQuery('foo'))
    await advance(299)
    expect(getGithubRepos).not.toHaveBeenCalled()

    getGithubRepos.mockResolvedValue(repoList('a/foo'))
    await advance(1)
    expect(getGithubRepos).toHaveBeenCalledTimes(1)
    expect(getGithubRepos).toHaveBeenCalledWith({ query: 'foo' })
    expect(result.current.repos).toEqual([{ name: 'a/foo' }])
  })

  it('ignores the result of an in-flight request once the query changes', async () => {
    let resolveFirst
    getGithubRepos.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    const { result } = renderHook(() => useRepoPicker())
    await advance(0)

    getGithubRepos.mockResolvedValue(repoList('a/new'))
    act(() => result.current.setQuery('new'))
    await advance(300)
    expect(result.current.repos).toEqual([{ name: 'a/new' }])

    await act(async () => resolveFirst(repoList('a/stale')))
    expect(result.current.repos).toEqual([{ name: 'a/new' }])
  })

  it("sets repos to 'error' on a rejected fetch and retry() refetches", async () => {
    getGithubRepos.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useRepoPicker())
    await advance(0)
    expect(result.current.repos).toBe('error')

    getGithubRepos.mockResolvedValue(repoList('a/one'))
    act(() => result.current.retry())
    await advance(0)

    expect(getGithubRepos).toHaveBeenCalledTimes(2)
    expect(result.current.repos).toEqual([{ name: 'a/one' }])
  })

  it('filters out excludeRepos', async () => {
    getGithubRepos.mockResolvedValue(repoList('a/one', 'a/two'))
    const { result } = renderHook(() => useRepoPicker({ excludeRepos: ['a/one'] }))
    await advance(0)
    expect(result.current.repos).toEqual([{ name: 'a/two' }])
  })

  it('toggle adds then removes a name', () => {
    getGithubRepos.mockResolvedValue(repoList())
    const { result } = renderHook(() => useRepoPicker())

    act(() => result.current.toggle('a/one'))
    expect(result.current.selected).toEqual(['a/one'])
    act(() => result.current.toggle('a/two'))
    expect(result.current.selected).toEqual(['a/one', 'a/two'])
    act(() => result.current.toggle('a/one'))
    expect(result.current.selected).toEqual(['a/two'])
  })
})
