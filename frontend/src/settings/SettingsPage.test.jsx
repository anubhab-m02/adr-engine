import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getAuthStatus, getConfig } from '../api.js'
import SettingsPage from './SettingsPage.jsx'

vi.mock('../api.js', () => ({
  getAuthStatus: vi.fn(),
  disconnectGithub: vi.fn(),
  getConfig: vi.fn(),
  patchConfig: vi.fn(),
}))

describe('SettingsPage', () => {
  it('renders the GitHub, Gemini, and Models sections', async () => {
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })
    getConfig.mockResolvedValue({ gemini_api_key: 'gk_1…cdef', ollama_host: 'http://localhost:11434' })

    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(await screen.findByText('Connected as octocat')).toBeInTheDocument()
    expect(await screen.findByText('gk_1…cdef')).toBeInTheDocument()
    expect(await screen.findByLabelText('Ollama host')).toHaveValue('http://localhost:11434')
  })
})
