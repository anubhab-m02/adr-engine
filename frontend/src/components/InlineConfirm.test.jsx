import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import InlineConfirm from './InlineConfirm.jsx'

describe('InlineConfirm', () => {
  it('renders the message with the default confirm label', () => {
    render(<InlineConfirm message="Remove this repo?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Remove this repo?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('uses a custom confirm label', () => {
    render(<InlineConfirm message="m" confirmLabel="Disconnect" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('calls the confirm and cancel handlers', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<InlineConfirm message="m" onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disabled disables only the confirm button', () => {
    render(<InlineConfirm message="m" disabled onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('renders error in a role=alert element', () => {
    render(<InlineConfirm message="m" error="Nope" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Nope')
  })

  it('renders no alert without an error', () => {
    render(<InlineConfirm message="m" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
