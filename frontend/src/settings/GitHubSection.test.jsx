import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { disconnectGithub, getAuthStatus } from '../api.js'
import GitHubSection from './GitHubSection.jsx'

vi.mock('../api.js', () => ({ getAuthStatus: vi.fn(), disconnectGithub: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
})

describe('GitHubSection', () => {
  it('renders the connected state with the login', async () => {
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })

    render(<GitHubSection />)

    expect(await screen.findByText('Connected as octocat')).toBeInTheDocument()
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
