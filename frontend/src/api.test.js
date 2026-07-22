import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getIngestStatus, getRepos, postQuery } from './api.js'

function mockFetchOnce(response) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: () => Promise.resolve(response.body),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getRepos', () => {
  it('GETs /repos and resolves with the parsed body', async () => {
    const body = { repos: [{ repo: 'owner/repo-a', indexed_units: 12 }] }
    mockFetchOnce({ body })

    const result = await getRepos()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(/\/repos$/)
    expect(options.method).toBe('GET')
    expect(result).toEqual(body)
  })
})

describe('postQuery', () => {
  it('POSTs /query with the question and repos as JSON', async () => {
    const body = { answer: 'Because Redis was already in use.', citations: [], retrieved_count: 0 }
    mockFetchOnce({ body })

    const result = await postQuery({ question: 'Why Redis?', repos: ['owner/repo-a'] })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(/\/query$/)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ question: 'Why Redis?', repos: ['owner/repo-a'] })
    expect(result).toEqual(body)
  })
})

describe('getIngestStatus', () => {
  it('GETs /ingest/status and resolves with the parsed body', async () => {
    const body = { active: true, repos: [] }
    mockFetchOnce({ body })

    const result = await getIngestStatus()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(/\/ingest\/status$/)
    expect(options.method).toBe('GET')
    expect(result).toEqual(body)
  })
})

describe('error handling', () => {
  it('throws an ApiError with the backend detail message on a non-2xx response', async () => {
    mockFetchOnce({ ok: false, status: 502, body: { detail: 'Gemini returned 401' } })

    await expect(getRepos()).rejects.toMatchObject(
      new ApiError(502, 'Gemini returned 401'),
    )
  })

  it('falls back to a generic message when the error body has no detail', async () => {
    mockFetchOnce({ ok: false, status: 500, body: {} })

    await expect(getRepos()).rejects.toMatchObject(
      new ApiError(500, 'Request failed with status 500'),
    )
  })

  it('throws an ApiError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getRepos()).rejects.toBeInstanceOf(ApiError)
  })
})
