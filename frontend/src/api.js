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

export function getIngestStatus() {
  return request('/ingest/status', { method: 'GET' })
}

export function getSetupState() {
  return request('/setup/state', { method: 'GET' })
}
