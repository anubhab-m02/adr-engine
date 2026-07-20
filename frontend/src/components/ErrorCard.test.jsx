import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorCard from './ErrorCard.jsx'

describe('ErrorCard', () => {
  it('renders the error message', () => {
    render(<ErrorCard message="Backend unreachable" onRetry={() => {}} />)
    expect(screen.getByText('Backend unreachable')).toBeInTheDocument()
  })

  it('calls onRetry exactly once per click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorCard message="Backend unreachable" onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('disables the Retry button when disabled is true', () => {
    render(<ErrorCard message="Backend unreachable" onRetry={() => {}} disabled />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()
  })
})
