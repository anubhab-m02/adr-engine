import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SourcesView from './SourcesView.jsx'

const citations = [
  {
    id: 'unit-a',
    kind: 'pr',
    ref: '42',
    url: 'https://github.com/owner/repo/pull/42',
    title: 'Switch auth to OAuth2 for third-party integrations',
    decision: 'Switched auth to OAuth2 device flow.',
    rationale: 'Avoids storing long-lived tokens for third-party integrations.',
    author: 'octocat',
    date: '2024-01-01T00:00:00Z',
    repo: 'owner/repo',
  },
  {
    id: 'unit-b',
    kind: 'commit',
    ref: 'a1b2c3d4e5f6',
    url: 'https://github.com/owner/repo/commit/a1b2c3d4e5f6',
    title: 'Add retry logic to the GitHub client',
    decision: 'Added exponential-backoff retries to the GitHub client.',
    rationale: 'Rate-limit responses were surfacing as hard failures.',
    author: 'octocat',
    date: '2024-01-01T00:00:00Z',
    repo: 'owner/repo',
  },
]

describe('SourcesView', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('renders a serif lead-in stating the real citation count', () => {
    render(<SourcesView citations={citations} />)
    expect(screen.getByText('2 decisions found —')).toBeInTheDocument()
  })

  it('singularizes the lead-in for exactly one citation', () => {
    render(<SourcesView citations={[citations[0]]} />)
    expect(screen.getByText('1 decision found —')).toBeInTheDocument()
  })

  it('renders one SourceCard per citation', () => {
    render(<SourcesView citations={citations} />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('renders each card expanded, with decision and rationale text', () => {
    render(<SourcesView citations={citations} />)
    expect(screen.getByText(citations[0].decision)).toBeInTheDocument()
    expect(screen.getByText(citations[0].rationale)).toBeInTheDocument()
    expect(screen.getByText(citations[1].decision)).toBeInTheDocument()
    expect(screen.getByText(citations[1].rationale)).toBeInTheDocument()
  })

  it('renders no source cards when citations is empty', () => {
    render(<SourcesView citations={[]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('0 decisions found —')).toBeInTheDocument()
  })

  it('shows the Settings banner by default', () => {
    render(<SourcesView citations={citations} />)
    expect(
      screen.getByText('Add a Gemini key in Settings to get synthesized answers.'),
    ).toBeInTheDocument()
  })

  it('dismisses the banner on click and keeps it dismissed within the session', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<SourcesView citations={citations} />)

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(
      screen.queryByText('Add a Gemini key in Settings to get synthesized answers.'),
    ).not.toBeInTheDocument()

    unmount()
    render(<SourcesView citations={citations} />)
    expect(
      screen.queryByText('Add a Gemini key in Settings to get synthesized answers.'),
    ).not.toBeInTheDocument()
  })
})
