import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { retryIngest } from '../api.js'
import RetryButton from './RetryButton.jsx'

vi.mock('../api.js', () => ({ retryIngest: vi.fn() }))

describe('RetryButton', () => {
  it('calls retryIngest with the exact repo name and notifies the parent on success', async () => {
    retryIngest.mockResolvedValue({ job_id: 'job-1' })
    const onRetried = vi.fn()
    render(<RetryButton repo="owner/repo" onRetried={onRetried} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(retryIngest).toHaveBeenCalledWith('owner/repo')
    await screen.findByRole('button', { name: 'Retry' })
    expect(onRetried).toHaveBeenCalled()
  })

  it('shows an inline alert and does not notify the parent when the call fails', async () => {
    retryIngest.mockRejectedValue(new Error('network error'))
    const onRetried = vi.fn()
    render(<RetryButton repo="owner/repo" onRetried={onRetried} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't retry this repo.")
    expect(onRetried).not.toHaveBeenCalled()
  })
})
