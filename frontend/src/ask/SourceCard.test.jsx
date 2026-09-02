import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SourceCard from './SourceCard.jsx'

const prUnit = {
  id: 'unit-pr-42',
  kind: 'pr',
  ref: '42',
  url: 'https://github.com/owner/repo/pull/42',
  title: 'Switch auth to OAuth2 for third-party integrations',
  decision: 'Switched auth to OAuth2 device flow.',
  rationale: 'Avoids storing long-lived tokens for third-party integrations.',
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

  it('defaults to a fixed card width', () => {
    render(<SourceCard unit={prUnit} />)
    expect(screen.getByRole('link')).toHaveClass('w-full', 'sm:w-64')
  })

  it('accepts a widthClassName override, e.g. to fill a margin grid column', () => {
    render(<SourceCard unit={prUnit} widthClassName="w-full" />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('w-full')
    expect(link).not.toHaveClass('sm:w-64')
  })

  it('defaults to the panel background, not highlighted', () => {
    render(<SourceCard unit={prUnit} />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('bg-panel')
    expect(link).not.toHaveClass('bg-highlight')
  })

  it('washes with the highlight background when highlighted', () => {
    render(<SourceCard unit={prUnit} highlighted />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('bg-highlight')
    expect(link).not.toHaveClass('bg-panel')
  })

  it('renders decision and rationale text instead of the title when expanded', () => {
    render(<SourceCard unit={prUnit} expanded />)
    expect(screen.getByText(prUnit.decision)).toBeInTheDocument()
    expect(screen.getByText(prUnit.rationale)).toBeInTheDocument()
    expect(screen.queryByText(prUnit.title)).not.toBeInTheDocument()
  })

  it('renders the title instead of decision/rationale by default', () => {
    render(<SourceCard unit={prUnit} />)
    expect(screen.getByText(prUnit.title)).toBeInTheDocument()
    expect(screen.queryByText(prUnit.decision)).not.toBeInTheDocument()
  })
})
