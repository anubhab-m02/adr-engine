import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { getAuthStatus, getDecisions, getIngestStatus, getRepos, getSetupState } from './api.js'

vi.mock('./api.js', () => ({
  getSetupState: vi.fn(),
  getRepos: vi.fn(),
  postQuery: vi.fn(),
  getIngestStatus: vi.fn(),
  getDecisions: vi.fn(),
  getAuthStatus: vi.fn(),
}))

// OnboardingPage has its own dedicated test file for its step machine —
// here it's just a boundary stub so App's routing/gate tests don't also
// need to satisfy OnboardingPage's own API calls (getConfig, etc.).
vi.mock('./onboarding/OnboardingPage.jsx', () => ({
  default: () => <div>Onboarding stub</div>,
}))

const INCOMPLETE_STATE = {
  github_connected: false,
  repos_selected: false,
  first_index_done: false,
  gemini_key_set: false,
}

const COMPLETE_STATE = {
  github_connected: true,
  repos_selected: true,
  first_index_done: true,
  gemini_key_set: false,
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  getRepos.mockResolvedValue({ repos: [] })
  getIngestStatus.mockResolvedValue({ active: false, repos: [] })
  getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('App', () => {
  it('redirects to /onboarding when setup is incomplete', async () => {
    getSetupState.mockResolvedValue(INCOMPLETE_STATE)

    renderAt('/library')

    expect(await screen.findByText('Onboarding stub')).toBeInTheDocument()
  })

  it('redirects to /onboarding when GET /setup/state fails', async () => {
    getSetupState.mockRejectedValue(new Error('network error'))

    renderAt('/')

    expect(await screen.findByText('Onboarding stub')).toBeInTheDocument()
  })

  it('renders the requested route inside the app shell when setup is complete', async () => {
    getSetupState.mockResolvedValue(COMPLETE_STATE)

    renderAt('/library')

    expect(await screen.findByRole('link', { name: 'Library', current: 'page' })).toBeInTheDocument()
    expect(screen.getByText('adr-engine')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ask' })).toBeInTheDocument()
  })

  it('redirects /onboarding away to / once setup is complete', async () => {
    getSetupState.mockResolvedValue(COMPLETE_STATE)

    renderAt('/onboarding')

    expect(await screen.findByLabelText('Ask a question')).toBeInTheDocument()
  })

  it('renders DecisionTimeline scoped to the repo at /library/:repo/timeline', async () => {
    getSetupState.mockResolvedValue(COMPLETE_STATE)
    getDecisions.mockResolvedValue({ units: [], total: 0, page: 1, limit: 20 })

    renderAt('/library/owner%2Frepo/timeline')

    expect(await screen.findByText('owner/repo · Timeline')).toBeInTheDocument()
    expect(getDecisions).toHaveBeenCalledWith({ repo: 'owner/repo', since: undefined, until: undefined })
  })

  it('renders DecisionGraph scoped to the repo at /library/:repo/graph', async () => {
    getSetupState.mockResolvedValue(COMPLETE_STATE)
    getDecisions.mockResolvedValue({ units: [], total: 0, page: 1, limit: 20 })

    renderAt('/library/owner%2Frepo/graph')

    expect(await screen.findByText('owner/repo · Graph')).toBeInTheDocument()
    expect(getDecisions).toHaveBeenCalledWith({ repo: 'owner/repo' })
  })
})
