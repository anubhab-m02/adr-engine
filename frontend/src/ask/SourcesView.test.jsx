import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SourcesView from './SourcesView.jsx'

const citations = [
  {
    id: 'unit-a',
    kind: 'pr',
    ref: '42',
    url: 'https://github.com/owner/repo/pull/42',
    title: 'Switch auth to OAuth2 for third-party integrations',
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
    author: 'octocat',
    date: '2024-01-01T00:00:00Z',
    repo: 'owner/repo',
  },
]

describe('SourcesView', () => {
  it('renders the explanatory header', () => {
    render(<SourcesView citations={citations} />)
    expect(
      screen.getByText('No Gemini key configured — showing retrieved sources directly.'),
    ).toBeInTheDocument()
  })

  it('renders one SourceCard per citation', () => {
    render(<SourcesView citations={citations} />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('renders no source cards when citations is empty', () => {
    render(<SourcesView citations={[]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
