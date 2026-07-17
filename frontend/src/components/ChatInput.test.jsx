import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChatInput from './ChatInput.jsx'

describe('ChatInput', () => {
  it('submits the trimmed question on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChatInput onSubmit={onSubmit} disabled={false} />)

    await user.type(screen.getByLabelText('Ask a question'), '  why auth?  ')
    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('why auth?')
  })

  it('does not submit on Shift+Enter, inserts a newline instead', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChatInput onSubmit={onSubmit} disabled={false} />)

    const textarea = screen.getByLabelText('Ask a question')
    await user.type(textarea, 'line one')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'line two')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('line one\nline two')
  })

  it('does not call onSubmit for empty or whitespace-only input', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ChatInput onSubmit={onSubmit} disabled={false} />)

    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Ask a question'), '   ')
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('respects disabled state', () => {
    const onSubmit = vi.fn()
    render(<ChatInput onSubmit={onSubmit} disabled={true} />)

    expect(screen.getByLabelText('Ask a question')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
  })
})
