import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RetryCard from './RetryCard.jsx'

describe('RetryCard', () => {
  it('announces a danger-toned message via role="alert"', () => {
    render(<RetryCard message="Authorization was denied." messageTone="danger" onRetry={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Authorization was denied.')
  })

  it('announces a muted message via role="status"', () => {
    render(<RetryCard message="Code expired." onRetry={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Code expired.')
  })
})
