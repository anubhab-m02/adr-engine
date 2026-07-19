import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MessageList from './MessageList.jsx'

const citation = {
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

  it('renders AnswerCard for an assistant answer message', () => {
    render(
      <MessageList
        messages={[
          { role: 'assistant', type: 'answer', answer: 'We use OAuth2 for auth.', citations: [citation] },
        ]}
      />,
    )
    expect(screen.getByText('We use OAuth2 for auth.')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', citation.url)
  })

  it('renders AnswerCard for an assistant message with an omitted type (defaults to answer)', () => {
    render(
      <MessageList
        messages={[{ role: 'assistant', answer: 'We use OAuth2 for auth.', citations: [] }]}
      />,
    )
    expect(screen.getByText('We use OAuth2 for auth.')).toBeInTheDocument()
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
