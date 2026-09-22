import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LoadingCard from './LoadingCard.jsx'

describe('LoadingCard', () => {
  it('renders a single honest status message', () => {
    render(<LoadingCard />)
    expect(screen.getByRole('status')).toHaveTextContent('Searching decision history…')
  })
})
