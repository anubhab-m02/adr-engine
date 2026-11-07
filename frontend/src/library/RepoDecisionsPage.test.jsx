import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import RepoDecisionsPage from './RepoDecisionsPage.jsx'

vi.mock('./DecisionTimeline.jsx', () => ({ default: ({ repo }) => <div data-testid="view">timeline:{repo}</div> }))
vi.mock('./DecisionGraph.jsx', () => ({ default: ({ repo }) => <div data-testid="view">graph:{repo}</div> }))
vi.mock('./RepoFileTree.jsx', () => ({ default: ({ repo }) => <div data-testid="view">files:{repo}</div> }))

function renderPage(view) {
  return render(
    <MemoryRouter initialEntries={['/library/owner%2Frepo/x']}>
      <Routes>
        <Route path="/library/:repo/x" element={<RepoDecisionsPage view={view} />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RepoDecisionsPage', () => {
  it.each([
    ['timeline', 'Timeline'],
    ['graph', 'Graph'],
    ['files', 'Files'],
  ])('renders the %s view with the decoded repo', (view, label) => {
    renderPage(view)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`owner/repo · ${label}`)
    expect(screen.getByTestId('view')).toHaveTextContent(`${view}:owner/repo`)
  })

  it('links back to /library', () => {
    renderPage('timeline')
    expect(screen.getByRole('link', { name: 'Back to Library' })).toHaveAttribute('href', '/library')
  })
})
