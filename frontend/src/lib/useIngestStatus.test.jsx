import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngestStatusProvider, useIngestStatus } from './useIngestStatus.js'

function mockFetchSequence(bodies) {
  const fetchMock = vi.fn()
  bodies.forEach((body) => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(body) })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function Consumer({ label }) {
  const { status } = useIngestStatus()
  return <div data-testid={label}>{status ? (status.active ? 'active' : 'idle') : 'loading'}</div>
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('IngestStatusProvider', () => {
  it('polls again after the interval while a job is active', async () => {
    const activeBody = { active: true, repos: [] }
    const fetchMock = mockFetchSequence([activeBody, activeBody, { active: false, repos: [] }])

    render(
      <IngestStatusProvider>
        <Consumer label="a" />
      </IngestStatusProvider>,
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops polling once active flips false', async () => {
    const fetchMock = mockFetchSequence([{ active: false, repos: [] }])

    render(
      <IngestStatusProvider>
        <Consumer label="a" />
      </IngestStatusProvider>,
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('a')).toHaveTextContent('idle')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares a single poll loop across multiple consumers', async () => {
    const activeBody = { active: true, repos: [] }
    const fetchMock = mockFetchSequence([activeBody, { active: false, repos: [] }])

    render(
      <IngestStatusProvider>
        <Consumer label="a" />
        <Consumer label="b" />
      </IngestStatusProvider>,
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('a')).toHaveTextContent('active')
    expect(screen.getByTestId('b')).toHaveTextContent('active')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('a')).toHaveTextContent('idle')
    expect(screen.getByTestId('b')).toHaveTextContent('idle')
  })

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function Lonely() {
      useIngestStatus()
      return null
    }

    expect(() => render(<Lonely />)).toThrow('useIngestStatus must be used within an IngestStatusProvider')
  })
})
