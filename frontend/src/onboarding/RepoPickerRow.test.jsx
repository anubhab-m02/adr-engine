import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RepoPickerRow from './RepoPickerRow.jsx'

describe('RepoPickerRow', () => {
  it('renders the repo name and commit estimate', () => {
    render(
      <RepoPickerRow
        repo={{ name: 'owner/repo', private: false, commit_count_estimate: 42 }}
        selected={false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('owner/repo')).toBeInTheDocument()
    expect(screen.getByText('42 commits')).toBeInTheDocument()
    expect(screen.queryByText('Private')).not.toBeInTheDocument()
  })

  it('abbreviates large commit counts', () => {
    render(
      <RepoPickerRow
        repo={{ name: 'owner/repo', private: false, commit_count_estimate: 1200 }}
        selected={false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('~1.2k commits')).toBeInTheDocument()
  })

  it('shows a private badge for private repos', () => {
    render(
      <RepoPickerRow
        repo={{ name: 'owner/repo', private: true, commit_count_estimate: 1 }}
        selected={false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('calls onToggle with the repo name when the checkbox changes', () => {
    const onToggle = vi.fn()
    render(
      <RepoPickerRow
        repo={{ name: 'owner/repo', private: false, commit_count_estimate: 1 }}
        selected={false}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith('owner/repo')
  })

  it('reflects the selected state on the checkbox', () => {
    render(
      <RepoPickerRow
        repo={{ name: 'owner/repo', private: false, commit_count_estimate: 1 }}
        selected
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
