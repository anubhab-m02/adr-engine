import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CitationCard from './CitationCard.jsx'

const prUnit = {
  kind: 'pr',
  ref: '42',
  url: 'https://github.com/owner/repo/pull/42',
  title: 'Switch auth to OAuth2 for third-party integrations',
  author: 'octocat',
  date: '2024-01-01T00:00:00Z',
  repo: 'owner/repo',
}

const commitUnit = {
  kind: 'commit',
  ref: 'a1b2c3d4e5f6',
  url: 'https://github.com/owner/repo/commit/a1b2c3d4e5f6',
  title: 'Add retry logic to the GitHub client',
  author: 'octocat',
  date: '2024-01-01T00:00:00Z',
  repo: 'owner/repo',
}

describe('CitationCard', () => {
  it('renders a PR badge for kind: pr', () => {
    render(<CitationCard unit={prUnit} />)
    expect(screen.getByText('PR #42')).toBeInTheDocument()
  })

  it('renders a short-SHA commit badge for kind: commit', () => {
    render(<CitationCard unit={commitUnit} />)
    expect(screen.getByText('commit a1b2c3d')).toBeInTheDocument()
  })

  it('links to unit.url', () => {
    render(<CitationCard unit={prUnit} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', prUnit.url)
  })

  it('has the spec accessible name', () => {
    render(<CitationCard unit={prUnit} />)
    expect(
      screen.getByRole('link', {
        name: 'Citation: Switch auth to OAuth2 for third-party integrations, pr in owner/repo',
      }),
    ).toBeInTheDocument()
  })
})
