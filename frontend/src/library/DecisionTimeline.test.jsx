import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DecisionTimeline from './DecisionTimeline.jsx'
import { getDecisions } from '../api.js'

vi.mock('../api.js', () => ({
  getDecisions: vi.fn(),
}))

afterEach(() => {
  vi.resetAllMocks()
})

const UNITS = [
  {
    id: 'unit-1',
    repo: 'owner/repo',
    kind: 'pr',
    ref: '42',
    url: 'https://github.com/owner/repo/pull/42',
    author: 'alice',
    date: '2026-02-10T12:00:00Z',
    title: 'Switch to OAuth2 device flow',
    decision: 'Use device flow',
    rationale: 'Simpler for CLI-less setup',
    alternatives: [],
    source_excerpt: '',
  },
  {
    id: 'unit-2',
    repo: 'owner/repo',
    kind: 'commit',
    ref: 'abcdef1234',
    url: 'https://github.com/owner/repo/commit/abcdef1234',
    author: 'bob',
    date: '2026-02-10T09:00:00Z',
    title: 'Cache PersistentClient factory',
    decision: 'Cache the client',
    rationale: 'Avoid repeated disk opens',
    alternatives: [],
    source_excerpt: '',
  },
  {
    id: 'unit-3',
    repo: 'owner/repo',
    kind: 'commit',
    ref: '9876543210',
    url: 'https://github.com/owner/repo/commit/9876543210',
    author: 'carol',
    date: '2026-01-05T09:00:00Z',
    title: 'Add diff filter for lockfiles',
    decision: 'Drop lockfile hunks',
    rationale: 'Keep extraction prompts small',
    alternatives: [],
    source_excerpt: '',
  },
]

describe('DecisionTimeline', () => {
  it('shows a loading state before the fetch resolves', () => {
    getDecisions.mockReturnValue(new Promise(() => {}))
    render(<DecisionTimeline repo="owner/repo" />)

    expect(screen.getByText('Loading timeline…')).toBeInTheDocument()
  })

  it('shows an explicit empty state when there are no decisions', async () => {
    getDecisions.mockResolvedValue({ units: [], total: 0, page: 1, limit: 20 })
    render(<DecisionTimeline repo="owner/repo" />)

    expect(await screen.findByText('No decisions indexed yet.')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    getDecisions.mockRejectedValue(new Error('network error'))
    render(<DecisionTimeline repo="owner/repo" />)

    expect(await screen.findByText("Couldn't load the timeline.")).toBeInTheDocument()
  })

  it('groups entries by date and preserves the newest-first order from the API', async () => {
    getDecisions.mockResolvedValue({ units: UNITS, total: 3, page: 1, limit: 20 })
    render(<DecisionTimeline repo="owner/repo" />)

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['February 10, 2026', 'January 5, 2026'])

    const titles = screen.getAllByText(/Switch to OAuth2|Cache PersistentClient|Add diff filter/)
    expect(titles.map((t) => t.textContent)).toEqual([
      'Switch to OAuth2 device flow',
      'Cache PersistentClient factory',
      'Add diff filter for lockfiles',
    ])
  })

  it('fetches the given repo and re-fetches when the repo prop changes', async () => {
    getDecisions.mockResolvedValue({ units: [], total: 0, page: 1, limit: 20 })
    const { rerender } = render(<DecisionTimeline repo="owner/repo-a" />)

    await screen.findByText('No decisions indexed yet.')
    expect(getDecisions).toHaveBeenCalledWith({ repo: 'owner/repo-a' })

    rerender(<DecisionTimeline repo="owner/repo-b" />)
    expect(getDecisions).toHaveBeenCalledWith({ repo: 'owner/repo-b' })
  })

  it('re-fetches with since/until when a date range is set, then drops them on clear', async () => {
    const user = userEvent.setup()
    getDecisions.mockResolvedValue({ units: [], total: 0, page: 1, limit: 20 })
    render(<DecisionTimeline repo="owner/repo" />)

    await screen.findByText('No decisions indexed yet.')
    expect(getDecisions).toHaveBeenCalledWith({ repo: 'owner/repo', since: undefined, until: undefined })

    await user.type(screen.getByLabelText('From'), '2026-01-01')
    expect(getDecisions).toHaveBeenLastCalledWith({
      repo: 'owner/repo',
      since: '2026-01-01',
      until: undefined,
    })

    await user.type(screen.getByLabelText('To'), '2026-02-01')
    expect(getDecisions).toHaveBeenLastCalledWith({
      repo: 'owner/repo',
      since: '2026-01-01',
      until: '2026-02-01',
    })

    await user.clear(screen.getByLabelText('From'))
    await user.clear(screen.getByLabelText('To'))
    expect(getDecisions).toHaveBeenLastCalledWith({ repo: 'owner/repo', since: undefined, until: undefined })
  })
})
