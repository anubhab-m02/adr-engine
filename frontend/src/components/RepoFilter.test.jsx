import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RepoFilter from './RepoFilter.jsx'

const repos = [
  { repo: 'owner/repo-a', indexed_units: 12 },
  { repo: 'owner/repo-b', indexed_units: 3 },
  { repo: 'owner/repo-c', indexed_units: 7 },
]

describe('RepoFilter', () => {
  it('renders a loading skeleton when repos is undefined', () => {
    render(<RepoFilter repos={undefined} selected={[]} onChange={() => {}} />)
    expect(screen.getByRole('status', { name: 'Loading repos' })).toBeInTheDocument()
  })

  it('renders a distinct failed state when repos is "error", not an eternal skeleton', () => {
    render(<RepoFilter repos="error" selected={[]} onChange={() => {}} />)
    expect(screen.queryByRole('status', { name: 'Loading repos' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load repos")
  })

  it('renders a static badge for a single repo, not a dropdown', () => {
    render(
      <RepoFilter
        repos={[repos[0]]}
        selected={['owner/repo-a']}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('owner/repo-a')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is closed by default and shows "All repos" when everything is selected', () => {
    render(
      <RepoFilter
        repos={repos}
        selected={repos.map((r) => r.repo)}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'All repos' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows a short summary when a subset is selected', () => {
    render(<RepoFilter repos={repos} selected={['owner/repo-a']} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '1 repo' })).toBeInTheDocument()
  })

  it('opens on click and closes on Escape', async () => {
    const user = userEvent.setup()
    render(
      <RepoFilter repos={repos} selected={repos.map((r) => r.repo)} onChange={() => {}} />,
    )

    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('has aria-haspopup="listbox" on the trigger button', () => {
    render(
      <RepoFilter repos={repos} selected={repos.map((r) => r.repo)} onChange={() => {}} />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('toggles a repo on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <RepoFilter repos={repos} selected={['owner/repo-a']} onChange={onChange} />,
    )

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('owner/repo-b'))

    expect(onChange).toHaveBeenCalledWith(['owner/repo-a', 'owner/repo-b'])
  })

  it('toggles the active option with arrow keys + Space', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RepoFilter repos={repos} selected={[]} onChange={onChange} />)

    await user.click(screen.getByRole('button'))
    await user.keyboard('{ArrowDown}')
    await user.keyboard(' ')

    expect(onChange).toHaveBeenCalledWith(['owner/repo-b'])
  })
})
