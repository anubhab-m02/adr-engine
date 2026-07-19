import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { getRepos, postQuery } from './api.js'

vi.mock('./api.js', () => ({
  getRepos: vi.fn(),
  postQuery: vi.fn(),
}))

const REPOS = { repos: [{ repo: 'owner/repo-a', indexed_units: 12 }] }

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('App', () => {
  it('shows a loading state then an answer after submitting a question', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)
    let resolveQuery
    postQuery.mockReturnValue(new Promise((resolve) => { resolveQuery = resolve }))

    render(<App />)

    await user.type(screen.getByLabelText('Ask a question'), 'Why OAuth2?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(postQuery).toHaveBeenCalledWith({ question: 'Why OAuth2?', repos: ['owner/repo-a'] })

    resolveQuery({ answer: 'We use OAuth2 for auth.', citations: [], retrieved_count: 0 })

    expect(await screen.findByText('We use OAuth2 for auth.')).toBeInTheDocument()
  })

  it('shows an ErrorCard with a working retry on a failed call', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)
    postQuery.mockRejectedValueOnce(new Error('Gemini returned 401'))

    render(<App />)

    await user.type(screen.getByLabelText('Ask a question'), 'Why Redis?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    expect(await screen.findByText('Gemini returned 401')).toBeInTheDocument()

    postQuery.mockResolvedValueOnce({
      answer: 'Redis was already used for caching.',
      citations: [],
      retrieved_count: 0,
    })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Redis was already used for caching.')).toBeInTheDocument()
    expect(postQuery).toHaveBeenCalledTimes(2)
  })

  it('fills the input when an example chip is clicked', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)

    render(<App />)

    const chip = await screen.findByRole('button', { name: 'Why is authentication done this way?' })
    await user.click(chip)

    expect(screen.getByLabelText('Ask a question')).toHaveValue(
      'Why is authentication done this way?',
    )
  })
})
