import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AskPage from './AskPage.jsx'
import { getAuthStatus, getRepos, postQuery } from '../api.js'

vi.mock('../api.js', () => ({
  getRepos: vi.fn(),
  postQuery: vi.fn(),
  getAuthStatus: vi.fn(),
}))

// AskPage registers a new-question handler with the command palette's
// shared context (see CommandPalette.test.jsx for that integration) — a
// real NewQuestionProvider isn't needed for AskPage's own behavior.
vi.mock('../lib/useNewQuestion.js', () => ({
  useRegisterNewQuestionHandler: vi.fn(),
}))

const REPOS = { repos: [{ repo: 'owner/repo-a', indexed_units: 12 }] }

function renderAskPage() {
  return render(
    <MemoryRouter>
      <AskPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })
  sessionStorage.clear()
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('AskPage', () => {
  it('shows a loading state then an answer after submitting a question', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)
    let resolveQuery
    postQuery.mockReturnValue(new Promise((resolve) => { resolveQuery = resolve }))

    renderAskPage()

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

    renderAskPage()

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

  it('disables Retry while a retry is in flight, preventing a double-fire race', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)
    postQuery.mockRejectedValueOnce(new Error('Gemini returned 401'))

    renderAskPage()

    await user.type(screen.getByLabelText('Ask a question'), 'Why Redis?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    expect(await screen.findByText('Gemini returned 401')).toBeInTheDocument()

    let resolveRetry
    postQuery.mockReturnValueOnce(new Promise((resolve) => { resolveRetry = resolve }))

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await user.click(retryButton)

    // Retry is now in flight (rendered as a LoadingCard) — the button that
    // triggered it is gone, and nothing else can fire a second concurrent
    // call while this one resolves.
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toBeInTheDocument()

    resolveRetry({ answer: 'Redis was already used for caching.', citations: [], retrieved_count: 0 })

    expect(await screen.findByText('Redis was already used for caching.')).toBeInTheDocument()
    expect(postQuery).toHaveBeenCalledTimes(2)
  })

  it('shows a distinct failed state, not an eternal skeleton, when GET /repos fails', async () => {
    getRepos.mockRejectedValue(new Error('network error'))

    renderAskPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load repos")
    expect(screen.queryByRole('status', { name: 'Loading repos' })).not.toBeInTheDocument()
  })

  it('fills the input when an example chip is clicked', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)

    renderAskPage()

    const chip = await screen.findByRole('button', { name: 'Why is repo-a built this way?' })
    await user.click(chip)

    expect(screen.getByLabelText('Ask a question')).toHaveValue('Why is repo-a built this way?')
  })

  it('generates up to 3 example chips from indexed repo short names', async () => {
    getRepos.mockResolvedValue({
      repos: [
        { repo: 'owner/repo-a', indexed_units: 12 },
        { repo: 'owner/repo-b', indexed_units: 3 },
        { repo: 'owner/repo-c', indexed_units: 1 },
        { repo: 'owner/repo-d', indexed_units: 1 },
      ],
    })

    renderAskPage()

    expect(await screen.findByRole('button', { name: 'Why is repo-a built this way?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Why is repo-b built this way?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Why is repo-c built this way?' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Why is repo-d built this way?' })).not.toBeInTheDocument()
  })

  it('falls back to the static example questions while repos are still loading', () => {
    getRepos.mockReturnValue(new Promise(() => {}))

    renderAskPage()

    expect(
      screen.getByRole('button', { name: 'Why is authentication done this way?' }),
    ).toBeInTheDocument()
  })

  it('falls back to the static example questions when GET /repos fails', async () => {
    getRepos.mockRejectedValue(new Error('network error'))

    renderAskPage()

    await screen.findByRole('alert')
    expect(
      screen.getByRole('button', { name: 'Why is authentication done this way?' }),
    ).toBeInTheDocument()
  })

  it('passes the real sent_to_cloud/cloud_synthesis_fields from the query response into the privacy panel', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)
    postQuery.mockResolvedValue({
      mode: 'synthesized',
      answer: 'We use OAuth2 for auth.',
      citations: [],
      retrieved_count: 0,
      sent_to_cloud: true,
      cloud_synthesis_fields: ['id', 'title', 'decision', 'rationale', 'url'],
    })

    renderAskPage()

    await user.type(screen.getByLabelText('Ask a question'), 'Why OAuth2?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    await screen.findByText('We use OAuth2 for auth.')
    await user.click(screen.getByText('What was sent'))

    expect(
      screen.getByText('These fields were sent to the cloud model to synthesize this answer:'),
    ).toBeInTheDocument()
    expect(screen.getByText('rationale')).toBeInTheDocument()
  })

  it('renders the input area as a plain footer, not a sticky floating bar', async () => {
    getRepos.mockResolvedValue(REPOS)

    const { container } = renderAskPage()
    await screen.findByLabelText('Ask a question')

    expect(container.querySelector('.sticky')).not.toBeInTheDocument()

    const input = screen.getByLabelText('Ask a question')
    const footer = input.closest('form').parentElement.parentElement
    expect(footer.className).not.toMatch(/\bsticky\b/)
    // the footer is the last element of the page's own content, i.e. it
    // scrolls with the composed page rather than floating over it
    expect(footer.parentElement.lastElementChild).toBe(footer)
  })

  it('shows a GitHub-expired banner when the auth status is expired', async () => {
    getRepos.mockResolvedValue(REPOS)
    getAuthStatus.mockResolvedValue({ state: 'expired' })

    renderAskPage()

    expect(await screen.findByText(/Your GitHub connection expired/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('does not show the GitHub-expired banner when the auth status is authorized', async () => {
    getRepos.mockResolvedValue(REPOS)
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })

    renderAskPage()

    await screen.findByLabelText('Ask a question')
    expect(screen.queryByText(/Your GitHub connection expired/)).not.toBeInTheDocument()
  })

  it('does not show the GitHub-expired banner when the auth status check fails', async () => {
    getRepos.mockResolvedValue(REPOS)
    getAuthStatus.mockRejectedValue(new Error('network error'))

    renderAskPage()

    await screen.findByLabelText('Ask a question')
    expect(screen.queryByText(/Your GitHub connection expired/)).not.toBeInTheDocument()
  })

  it('dismisses the GitHub-expired banner for the session, without re-showing it on remount', async () => {
    const user = userEvent.setup()
    getRepos.mockResolvedValue(REPOS)
    getAuthStatus.mockResolvedValue({ state: 'expired' })

    const { unmount } = renderAskPage()

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/Your GitHub connection expired/)).not.toBeInTheDocument()

    unmount()
    renderAskPage()

    await screen.findByLabelText('Ask a question')
    expect(screen.queryByText(/Your GitHub connection expired/)).not.toBeInTheDocument()
  })
})
