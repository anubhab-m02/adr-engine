import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getConfig, getSetupState } from '../api.js'
import OnboardingPage from './OnboardingPage.jsx'

vi.mock('../api.js', () => ({
  getSetupState: vi.fn(),
  getConfig: vi.fn(),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('./ConnectStep.jsx', () => ({ default: () => <div>Connect step</div> }))
vi.mock('./RepoPickerStep.jsx', () => ({ default: () => <div>Repo picker step</div> }))
vi.mock('./IndexStep.jsx', () => ({ default: ({ repos }) => <div>Index step for {repos.join(',')}</div> }))
vi.mock('./GeminiKeyStep.jsx', () => ({ default: () => <div>Gemini key step</div> }))

function renderPage() {
  return render(<OnboardingPage />, { wrapper: MemoryRouter })
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('OnboardingPage', () => {
  it('announces a loading status while setup state is pending, then replaces it with the step', async () => {
    let resolveState
    getSetupState.mockReturnValue(new Promise((resolve) => { resolveState = resolve }))

    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading setup…')

    resolveState({
      github_connected: false,
      repos_selected: false,
      first_index_done: false,
      gemini_key_set: false,
    })

    expect(await screen.findByText('Connect step')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('resumes at Connect when github is not connected', async () => {
    getSetupState.mockResolvedValue({
      github_connected: false,
      repos_selected: false,
      first_index_done: false,
      gemini_key_set: false,
    })

    renderPage()

    expect(await screen.findByText('Connect step')).toBeInTheDocument()
    expect(document.title).toBe('Connect GitHub · Setup')
    expect(screen.getByRole('img', { name: 'Step 1 of 3' })).toBeInTheDocument()
  })

  it('resumes at RepoPicker when connected but no repos selected', async () => {
    getSetupState.mockResolvedValue({
      github_connected: true,
      repos_selected: false,
      first_index_done: false,
      gemini_key_set: false,
    })

    renderPage()

    expect(await screen.findByText('Repo picker step')).toBeInTheDocument()
    expect(document.title).toBe('Choose repos · Setup')
    expect(screen.getByRole('img', { name: 'Step 2 of 3' })).toBeInTheDocument()
  })

  it('resumes at Index (with the configured repos) when repos are selected but not indexed', async () => {
    getSetupState.mockResolvedValue({
      github_connected: true,
      repos_selected: true,
      first_index_done: false,
      gemini_key_set: false,
    })
    getConfig.mockResolvedValue({ indexed_repos: ['owner/a', 'owner/b'] })

    renderPage()

    expect(await screen.findByText('Index step for owner/a,owner/b')).toBeInTheDocument()
    expect(document.title).toBe('Index · Setup')
    expect(screen.getByRole('img', { name: 'Step 3 of 3' })).toBeInTheDocument()
  })

  it('resumes at the optional Gemini step once indexing is done', async () => {
    getSetupState.mockResolvedValue({
      github_connected: true,
      repos_selected: true,
      first_index_done: true,
      gemini_key_set: false,
    })

    renderPage()

    expect(await screen.findByText('Gemini key step')).toBeInTheDocument()
    expect(document.title).toBe('Gemini key · Setup')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('navigates home immediately if setup is already fully complete', async () => {
    getSetupState.mockResolvedValue({
      github_connected: true,
      repos_selected: true,
      first_index_done: true,
      gemini_key_set: true,
    })

    renderPage()

    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'))
  })

  it('falls back to Connect when GET /setup/state fails', async () => {
    getSetupState.mockRejectedValue(new Error('network error'))

    renderPage()

    expect(await screen.findByText('Connect step')).toBeInTheDocument()
  })
})
