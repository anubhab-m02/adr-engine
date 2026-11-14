import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LoadingCard from './LoadingCard.jsx'
import { MESSAGE_CARD_BASE } from './messageCardBase.js'

describe('LoadingCard', () => {
  it('renders a single honest status message', () => {
    render(<LoadingCard />)
    expect(screen.getByRole('status')).toHaveTextContent('Searching decision history…')
  })

  it('renders the shared MESSAGE_CARD_BASE classes on its root', () => {
    render(<LoadingCard />)
    expect(screen.getByRole('status')).toHaveClass(...MESSAGE_CARD_BASE.split(' '))
  })
})
