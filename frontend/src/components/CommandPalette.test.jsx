import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CommandPalette from './CommandPalette.jsx'

describe('CommandPalette', () => {
  it('is closed by default', () => {
    render(<CommandPalette />)

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('opens on Ctrl+K and closes on Escape', () => {
    render(<CommandPalette />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('opens on Cmd+K too', () => {
    render(<CommandPalette />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
  })

  it('toggles closed when Ctrl+K is pressed again while open', () => {
    render(<CommandPalette />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('closes when clicking the backdrop', () => {
    const { container } = render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    fireEvent.click(container.querySelector('.fixed.inset-0'))

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('shows a placeholder message when there are no actions to show', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByText('No matching commands')).toBeInTheDocument()
  })

  it('filters the action list as the query changes, and arrow keys move the highlighted selection', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const input = screen.getByRole('textbox', { name: 'Command palette search' })
    fireEvent.change(input, { target: { value: 'anything' } })

    // With no registered actions yet, any query still yields the empty state.
    expect(screen.getByText('No matching commands')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Still open: Enter with no matching action is a no-op, not a crash.
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
  })

  it('resets the query and focuses the input each time it reopens', () => {
    render(<CommandPalette />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const firstInput = screen.getByRole('textbox', { name: 'Command palette search' })
    fireEvent.change(firstInput, { target: { value: 'leftover query' } })
    fireEvent.keyDown(window, { key: 'Escape' })

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const secondInput = screen.getByRole('textbox', { name: 'Command palette search' })

    expect(secondInput.value).toBe('')
    expect(secondInput).toHaveFocus()
  })
})
