import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AnswerCard from './AnswerCard.jsx'

const citation = {
  kind: 'pr',
  ref: '42',
  url: 'https://github.com/owner/repo/pull/42',
  title: 'Switch auth to OAuth2 for third-party integrations',
  author: 'octocat',
  date: '2024-01-01T00:00:00Z',
  repo: 'owner/repo',
}

describe('AnswerCard', () => {
  it('renders the answer text and a citation for each unit', () => {
    render(<AnswerCard answer="We use OAuth2 for auth." citations={[citation]} />)

    expect(screen.getByText('We use OAuth2 for auth.')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', citation.url)
  })

  it('renders no citation links when citations is empty', () => {
    render(<AnswerCard answer="Nothing in the indexed history covers this." citations={[]} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('styles the no-answer variant as muted, not an error', () => {
    render(<AnswerCard answer="Nothing in the indexed history covers this." citations={[]} />)

    const card = screen.getByText('Nothing in the indexed history covers this.').parentElement
    expect(card.className).toContain('text-ink-muted')
    expect(card.className).not.toContain('danger')
  })
})
