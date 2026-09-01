const BASE_URL = import.meta.env.VITE_API_BASE_URL

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, options)
  } catch {
    throw new ApiError(0, 'Could not reach the backend. Is it running?')
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json()
      if (body?.detail) message = body.detail
    } catch {
      // response body wasn't JSON — fall back to the generic message
    }
    throw new ApiError(response.status, message)
  }

  return response.json()
}

export function getRepos() {
  return request('/repos', { method: 'GET' })
}

export function postQuery({ question, repos }) {
  return request('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, repos }),
  })
}

export function patchRepo(repo, patch) {
  return request(`/repos/${repo}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export function getIngestStatus() {
  return request('/ingest/status', { method: 'GET' })
}

export function getSetupState() {
  return request('/setup/state', { method: 'GET' })
}

export function startDeviceFlow() {
  return request('/auth/github/device/start', { method: 'POST' })
}

export function getAuthStatus() {
  return request('/auth/github/status', { method: 'GET' })
}

export function disconnectGithub() {
  return request('/auth/github', { method: 'DELETE' })
}

export function getGithubRepos({ query } = {}) {
  const search = query ? `?query=${encodeURIComponent(query)}` : ''
  return request(`/github/repos${search}`, { method: 'GET' })
}

export function getConfig() {
  return request('/config', { method: 'GET' })
}

export function patchConfig(patch) {
  return request('/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export function clearIndex() {
  return request('/repos', { method: 'DELETE' })
}

export function postIngest({ repos } = {}) {
  return request('/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(repos ? { repos } : {}),
  })
}

export function retryIngest(repo) {
  return request(`/ingest/retry/${repo}`, { method: 'POST' })
}

export function getDecisions({ repo, since, until, page } = {}) {
  const params = new URLSearchParams({ repo })
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  if (page) params.set('page', page)
  return request(`/decisions?${params.toString()}`, { method: 'GET' })
}
