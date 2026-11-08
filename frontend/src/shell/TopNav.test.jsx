import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TopNav from './TopNav.jsx'

vi.mock('./StatusPill.jsx', () => ({ default: () => <span data-testid="status-pill" /> }))

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopNav />
    </MemoryRouter>,
  )
}

describe('TopNav', () => {
  it('shows Ask, Library and Settings links with accessible names and targets', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Ask' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByTestId('status-pill')).toBeInTheDocument()
  })

  it.each([
    ['/', 'Ask'],
    ['/library', 'Library'],
    ['/settings', 'Settings'],
  ])('marks only the current route active at %s', (path, active) => {
    renderAt(path)
    for (const name of ['Ask', 'Library', 'Settings']) {
      const link = screen.getByRole('link', { name })
      if (name === active) {
        expect(link).toHaveClass('text-accent')
        expect(link).toHaveAttribute('aria-current', 'page')
      } else {
        expect(link).not.toHaveClass('text-accent')
      }
    }
  })
})
