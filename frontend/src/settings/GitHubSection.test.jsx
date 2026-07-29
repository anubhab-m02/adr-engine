import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { disconnectGithub, getAuthStatus } from '../api.js'
import GitHubSection from './GitHubSection.jsx'

vi.mock('../api.js', () => ({ getAuthStatus: vi.fn(), disconnectGithub: vi.fn() }))
vi.mock('../onboarding/ConnectStep.jsx', () => ({
  default: ({ onAuthorized }) => (
    <button type="button" onClick={() => onAuthorized('octocat')}>
      Fake device flow complete
    </button>
  ),
}))

afterEach(() => {
  vi.resetAllMocks()
})

describe('GitHubSection', () => {
  it('renders the connected state with the login and avatar', async () => {
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat', avatar_url: 'https://example.com/a.png' })

    render(<GitHubSection />)

    expect(await screen.findByText('Connected as octocat')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: "octocat's avatar" })).toHaveAttribute('src', 'https://example.com/a.png')
    expect(screen.getByText('Scope: repo')).toBeInTheDocument()
  })

  it('renders the disconnected state when there is no authorized token', async () => {
    getAuthStatus.mockRejectedValue(new Error('no device flow in progress'))

    render(<GitHubSection />)

    expect(await screen.findByText('Not connected.')).toBeInTheDocument()
  })

  it('renders the disconnected state for a non-authorized status', async () => {
    getAuthStatus.mockResolvedValue({ state: 'pending', login: null })

    render(<GitHubSection />)

    expect(await screen.findByText('Not connected.')).toBeInTheDocument()
  })

  it('renders a distinct expired banner with a Reconnect action, not plain disconnected', async () => {
    getAuthStatus.mockResolvedValue({ state: 'expired' })

    render(<GitHubSection />)

    expect(await screen.findByRole('alert')).toHaveTextContent('GitHub connection expired')
    expect(screen.queryByText('Not connected.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
  })

  it('reconnecting from the expired state re-checks status and shows connected', async () => {
    getAuthStatus.mockResolvedValueOnce({ state: 'expired' })
    getAuthStatus.mockResolvedValueOnce({ state: 'authorized', login: 'octocat', avatar_url: null })

    render(<GitHubSection />)
    await screen.findByRole('button', { name: 'Reconnect' })

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fake device flow complete' }))

    expect(await screen.findByText('Connected as octocat')).toBeInTheDocument()
  })

  it('disconnect asks for inline confirmation, then calls DELETE /auth/github and shows disconnected', async () => {
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })
    disconnectGithub.mockResolvedValue()

    render(<GitHubSection />)
    await screen.findByText('Connected as octocat')

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(disconnectGithub).not.toHaveBeenCalled()
    expect(screen.getByText(/Disconnect GitHub\?/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(disconnectGithub).toHaveBeenCalledTimes(1)

    expect(await screen.findByText('Not connected.')).toBeInTheDocument()
  })

  it('cancel dismisses the confirmation without disconnecting', async () => {
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })

    render(<GitHubSection />)
    await screen.findByText('Connected as octocat')

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(disconnectGithub).not.toHaveBeenCalled()
    expect(screen.getByText('Connected as octocat')).toBeInTheDocument()
  })
})
