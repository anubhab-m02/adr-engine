import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import BookmarksList from './BookmarksList.jsx'

const URL_A = 'https://github.com/owner/repo/pull/42'
const URL_B = 'https://github.com/owner/repo/commit/a1b2c3d4e5f6'

function seed(entries) {
  localStorage.setItem('bookmarks', JSON.stringify(entries))
}

describe('BookmarksList', () => {
  beforeEach(() => localStorage.clear())

  it('renders each saved decision as a link to its commit/PR URL', () => {
    seed([
      { url: URL_A, title: 'Switch auth to OAuth2', savedAt: '2026-01-01T00:00:00Z' },
      { url: URL_B, title: 'Add retry logic', savedAt: '2026-01-02T00:00:00Z' },
    ])
    render(<BookmarksList />)
    expect(screen.getByRole('link', { name: 'Switch auth to OAuth2' })).toHaveAttribute('href', URL_A)
    expect(screen.getByRole('link', { name: 'Add retry logic' })).toHaveAttribute('href', URL_B)
  })

  it('removes an item when its remove button is clicked', async () => {
    seed([
      { url: URL_A, title: 'Switch auth to OAuth2', savedAt: '2026-01-01T00:00:00Z' },
      { url: URL_B, title: 'Add retry logic', savedAt: '2026-01-02T00:00:00Z' },
    ])
    render(<BookmarksList />)
    await userEvent.click(screen.getByRole('button', { name: /Remove saved decision: Add retry logic/ }))
    expect(screen.queryByRole('link', { name: 'Add retry logic' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch auth to OAuth2' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bookmarks')).map((b) => b.url)).toEqual([URL_A])
  })

  it('shows an empty state explaining how to save a decision', () => {
    render(<BookmarksList />)
    expect(screen.getByText(/No saved decisions yet/)).toBeInTheDocument()
    expect(screen.getByText(/Save button on a source card/)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
