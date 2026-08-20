import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MessageList from './MessageList.jsx'

const citation = {
  id: 'owner/repo:pr:42',
  kind: 'pr',
  ref: '42',
  url: 'https://github.com/owner/repo/pull/42',
  title: 'Switch auth to OAuth2 for third-party integrations',
  author: 'octocat',
  date: '2024-01-01T00:00:00Z',
  repo: 'owner/repo',
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('MessageList', () => {
  it('renders a right-aligned question bubble for user messages', () => {
    render(<MessageList messages={[{ role: 'user', content: 'Why OAuth2?' }]} />)
    expect(screen.getByText('Why OAuth2?')).toBeInTheDocument()
  })

  it('renders LoadingCard for an assistant loading message', () => {
    render(<MessageList messages={[{ role: 'assistant', type: 'loading' }]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders ErrorCard for an assistant error message', () => {
    render(
      <MessageList
        messages={[{ role: 'assistant', type: 'error', message: 'Backend unreachable', onRetry: () => {} }]}
      />,
    )
    expect(screen.getByText('Backend unreachable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('disables the Retry button when the list is disabled', () => {
    render(
      <MessageList
        messages={[{ role: 'assistant', type: 'error', message: 'Backend unreachable', onRetry: () => {} }]}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()
  })

  it('renders an AnswerPage with its sources for a synthesized answer message', () => {
    render(
      <MessageList
        messages={[
          { role: 'user', content: 'Why OAuth2?' },
          {
            role: 'assistant',
            type: 'answer',
            mode: 'synthesized',
            answer: 'We use OAuth2 for auth [owner/repo:pr:42].',
            citations: [citation],
          },
        ]}
        repos={[{ repo: 'owner/repo', indexed_units: 5 }]}
        selectedRepos={['owner/repo']}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Why OAuth2?' })).toBeInTheDocument()
    expect(screen.getByText('searched 1 repo · 5 decisions')).toBeInTheDocument()
    expect(screen.getByText(/We use OAuth2 for auth/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Citation:/ })[0]).toHaveAttribute('href', citation.url)
  })

  it('renders an AnswerPage for an assistant message with an omitted type (defaults to answer)', () => {
    render(
      <MessageList
        messages={[{ role: 'assistant', answer: 'We use OAuth2 for auth.', citations: [] }]}
      />,
    )
    expect(screen.getByText('We use OAuth2 for auth.')).toBeInTheDocument()
  })

  it('renders SourcesView for a sources_only answer message', () => {
    render(
      <MessageList
        messages={[
          {
            role: 'assistant',
            type: 'answer',
            mode: 'sources_only',
            answer: null,
            citations: [citation],
          },
        ]}
      />,
    )
    expect(
      screen.getByText('No Gemini key configured — showing retrieved sources directly.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', citation.url)
  })

  it('renders ErrorCard with a generic message for an unrecognized type', () => {
    render(<MessageList messages={[{ role: 'assistant', type: 'bogus' }]} />)
    expect(screen.getByText('Unrecognized message type: "bogus"')).toBeInTheDocument()
  })

  it('scrolls to the newest message on update', () => {
    const { rerender } = render(<MessageList messages={[{ role: 'user', content: 'first' }]} />)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()

    Element.prototype.scrollIntoView.mockClear()
    rerender(
      <MessageList
        messages={[
          { role: 'user', content: 'first' },
          { role: 'user', content: 'second' },
        ]}
      />,
    )
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
