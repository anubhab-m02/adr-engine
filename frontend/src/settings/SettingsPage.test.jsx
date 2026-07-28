import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getAuthStatus } from '../api.js'
import SettingsPage from './SettingsPage.jsx'

vi.mock('../api.js', () => ({ getAuthStatus: vi.fn(), disconnectGithub: vi.fn() }))

describe('SettingsPage', () => {
  it('renders the GitHub section', async () => {
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })

    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(await screen.findByText('Connected as octocat')).toBeInTheDocument()
  })
})
