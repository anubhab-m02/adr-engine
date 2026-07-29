import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SourceCard from './SourceCard.jsx'

const prUnit = {
  id: 'unit-pr-42',
  kind: 'pr',
  ref: '42',
  url: 'https://github.com/owner/repo/pull/42',
  title: 'Switch auth to OAuth2 for third-party integrations',
  author: 'octocat',
  date: '2024-01-01T00:00:00Z',
  repo: 'owner/repo',
}

const commitUnit = {
  id: 'unit-commit-a1b2c3d',
  kind: 'commit',
  ref: 'a1b2c3d4e5f6',
  url: 'https://github.com/owner/repo/commit/a1b2c3d4e5f6',
  title: 'Add retry logic to the GitHub client',
  author: 'octocat',
  date: '2024-01-01T00:00:00Z',
  repo: 'owner/repo',
}

describe('SourceCard', () => {
  it('renders a PR badge for kind: pr', () => {
    render(<SourceCard unit={prUnit} />)
    expect(screen.getByText('PR #42')).toBeInTheDocument()
  })

  it('renders a short-SHA commit badge for kind: commit', () => {
    render(<SourceCard unit={commitUnit} />)
    expect(screen.getByText('commit a1b2c3d')).toBeInTheDocument()
  })

  it('renders the title, author, relative date, and repo', () => {
    render(<SourceCard unit={prUnit} />)
    expect(screen.getByText(prUnit.title)).toBeInTheDocument()
    expect(screen.getByText(/octocat/)).toBeInTheDocument()
    expect(screen.getByText(/owner\/repo/)).toBeInTheDocument()
  })

  it('links to unit.url', () => {
    render(<SourceCard unit={prUnit} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', prUnit.url)
  })

  it('exposes the source-{id} anchor CitationMarker jumps to', () => {
    render(<SourceCard unit={prUnit} />)
    expect(screen.getByRole('link')).toHaveAttribute('id', 'source-unit-pr-42')
  })

  it('has the spec accessible name', () => {
    render(<SourceCard unit={prUnit} />)
    expect(
      screen.getByRole('link', {
        name: 'Citation: Switch auth to OAuth2 for third-party integrations, pr in owner/repo',
      }),
    ).toBeInTheDocument()
  })

  it('renders the marker number when provided', () => {
    render(<SourceCard unit={prUnit} number={1} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('omits the marker number when not provided', () => {
    render(<SourceCard unit={prUnit} />)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })
})
