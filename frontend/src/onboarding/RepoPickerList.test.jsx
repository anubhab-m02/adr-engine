import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RepoPickerList from './RepoPickerList.jsx'

function renderList(props) {
  return render(
    <RepoPickerList query="" selected={[]} onToggle={() => {}} onRetry={() => {}} emptyMessage="Nothing here." {...props} />,
  )
}

describe('RepoPickerList', () => {
  it('groups the rows under a labelled Repositories group', () => {
    renderList({ repos: [{ name: 'owner/a' }, { name: 'owner/b' }] })
    const group = screen.getByRole('group', { name: 'Repositories' })
    expect(within(group).getAllByRole('checkbox')).toHaveLength(2)
  })

  it.each([
    ['loading', undefined],
    ['error', 'error'],
    ['empty', []],
  ])('renders no Repositories group in the %s state', (_label, repos) => {
    renderList({ repos })
    expect(screen.queryByRole('group', { name: 'Repositories' })).not.toBeInTheDocument()
  })

  it('shows 5 skeletons while repos is undefined', () => {
    const { container } = renderList({ repos: undefined })
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it("shows a retry card that calls onRetry for 'error'", async () => {
    const onRetry = vi.fn()
    renderList({ repos: 'error', onRetry })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your repos.")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("shows 'No repos match.' for an empty result with a query", () => {
    renderList({ repos: [], query: 'zzz' })
    expect(screen.getByText('No repos match.')).toBeInTheDocument()
  })

  it('shows emptyMessage for an empty result without a query', () => {
    renderList({ repos: [] })
    expect(screen.getByText('Nothing here.')).toBeInTheDocument()
    expect(screen.queryByText('No repos match.')).not.toBeInTheDocument()
  })

  it('renders rows with the right selected state and toggles by name', async () => {
    const onToggle = vi.fn()
    renderList({
      repos: [{ name: 'a/one' }, { name: 'a/two' }],
      selected: ['a/two'],
      onToggle,
    })
    const [one, two] = screen.getAllByRole('checkbox')
    expect(one).not.toBeChecked()
    expect(two).toBeChecked()

    await userEvent.click(one)
    expect(onToggle).toHaveBeenCalledWith('a/one')
  })
})
