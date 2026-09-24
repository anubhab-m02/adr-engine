import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DecisionGraph from './DecisionGraph.jsx'
import { getDecisions } from '../api.js'

vi.mock('../api.js', () => ({
  getDecisions: vi.fn(),
}))

afterEach(() => {
  vi.resetAllMocks()
})

function renderDecisionGraph(repo) {
  return render(
    <MemoryRouter>
      <DecisionGraph repo={repo} />
    </MemoryRouter>,
  )
}

function unit(id, date, overrides = {}) {
  return {
    id,
    repo: 'owner/repo',
    kind: 'commit',
    ref: '9876543210',
    url: `https://github.com/owner/repo/commit/${id}`,
    author: 'carol',
    date,
    title: `Decision ${id}`,
    decision: 'Some decision',
    rationale: 'Some rationale',
    alternatives: [],
    source_excerpt: '',
    ...overrides,
  }
}

const UNITS = [
  unit('unit-1', '2026-02-10T12:00:00Z', { kind: 'pr', ref: '42' }),
  unit('unit-2', '2026-02-10T09:00:00Z'),
  unit('unit-3', '2026-01-05T09:00:00Z'),
]

describe('DecisionGraph', () => {
  it('shows a loading state before the fetch resolves', () => {
    getDecisions.mockReturnValue(new Promise(() => {}))
    renderDecisionGraph('owner/repo')

    expect(screen.getByText('Loading graph…')).toBeInTheDocument()
  })

  it('shows an explicit empty state when there are no decisions', async () => {
    getDecisions.mockResolvedValue({ units: [], total: 0, page: 1, limit: 20 })
    renderDecisionGraph('owner/repo')

    expect(await screen.findByText('No decisions indexed yet.')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    getDecisions.mockRejectedValue(new Error('network error'))
    renderDecisionGraph('owner/repo')

    expect(await screen.findByText("Couldn't load the graph.")).toBeInTheDocument()
  })

  it('renders one node per decision, grouped by date', async () => {
    getDecisions.mockResolvedValue({ units: UNITS, total: 3, page: 1, limit: 20 })
    renderDecisionGraph('owner/repo')

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['February 10, 2026', 'January 5, 2026'])

    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Decision unit-1, PR #42' })).toHaveAttribute(
      'href',
      '/library/owner%2Frepo/timeline#source-unit-1',
    )
  })

  it('renders a single node without crashing', async () => {
    getDecisions.mockResolvedValue({ units: [UNITS[0]], total: 1, page: 1, limit: 20 })
    renderDecisionGraph('owner/repo')

    expect(await screen.findAllByRole('link')).toHaveLength(1)
  })

  it('renders a large number of nodes across multiple rows without crashing', async () => {
    const many = Array.from({ length: 47 }, (_, i) => unit(`unit-${i}`, '2026-03-01T00:00:00Z'))
    getDecisions.mockResolvedValue({ units: many, total: 47, page: 1, limit: 20 })
    renderDecisionGraph('owner/repo')

    expect(await screen.findAllByRole('link')).toHaveLength(47)
  })

  it('fetches the given repo and re-fetches when the repo prop changes', async () => {
    getDecisions.mockResolvedValue({ units: [], total: 0, page: 1, limit: 20 })
    const { rerender } = renderDecisionGraph('owner/repo-a')

    await screen.findByText('No decisions indexed yet.')
    expect(getDecisions).toHaveBeenCalledWith({ repo: 'owner/repo-a' })

    rerender(
      <MemoryRouter>
        <DecisionGraph repo="owner/repo-b" />
      </MemoryRouter>,
    )
    expect(getDecisions).toHaveBeenCalledWith({ repo: 'owner/repo-b' })
  })

  it('percent-encodes a repo name containing a slash in the node link', async () => {
    getDecisions.mockResolvedValue({ units: [UNITS[0]], total: 1, page: 1, limit: 20 })
    renderDecisionGraph('owner/some-repo')

    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      '/library/owner%2Fsome-repo/timeline#source-unit-1',
    )
  })
})
