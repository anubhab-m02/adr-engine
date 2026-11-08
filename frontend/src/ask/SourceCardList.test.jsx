import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SourceCardList from './SourceCardList.jsx'

const citations = [
  {
    id: 'unit-pr-42',
    kind: 'pr',
    ref: '42',
    url: 'https://github.com/owner/repo/pull/42',
    title: 'Switch auth to OAuth2',
    decision: 'Switched auth to OAuth2 device flow.',
    rationale: 'Avoids long-lived tokens.',
    author: 'octocat',
    date: '2024-01-01T00:00:00Z',
    repo: 'owner/repo',
  },
  {
    id: 'unit-commit-a1b2c3d',
    kind: 'commit',
    ref: 'a1b2c3d4e5f6',
    url: 'https://github.com/owner/repo/commit/a1b2c3d4e5f6',
    title: 'Add retry logic',
    decision: 'Retry GitHub calls on 5xx.',
    rationale: 'Transient failures were aborting ingestion.',
    author: 'octocat',
    date: '2024-01-02T00:00:00Z',
    repo: 'owner/repo',
  },
]

describe('SourceCardList', () => {
  it('renders one card per citation, linking to its URL', () => {
    render(<SourceCardList citations={citations} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', citations[0].url)
    expect(links[1]).toHaveAttribute('href', citations[1].url)
  })

  it('shows titles by default and decision/rationale when expanded', () => {
    const { rerender } = render(<SourceCardList citations={citations} />)
    expect(screen.getByText('Switch auth to OAuth2')).toBeInTheDocument()
    expect(screen.queryByText('Switched auth to OAuth2 device flow.')).not.toBeInTheDocument()

    rerender(<SourceCardList citations={citations} expanded />)
    expect(screen.getByText('Switched auth to OAuth2 device flow.')).toBeInTheDocument()
    expect(screen.getByText('Transient failures were aborting ingestion.')).toBeInTheDocument()
  })

  it('renders nothing for an empty list', () => {
    render(<SourceCardList citations={[]} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
