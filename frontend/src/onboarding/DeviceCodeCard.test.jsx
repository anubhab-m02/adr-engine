import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthStatus } from '../api.js'
import DeviceCodeCard from './DeviceCodeCard.jsx'

vi.mock('../api.js', () => ({ getAuthStatus: vi.fn() }))

function renderCard(props = {}) {
  return render(
    <DeviceCodeCard
      userCode="WDJB-MJHT"
      verificationUri="https://github.com/login/device"
      interval={5}
      onAuthorized={vi.fn()}
      onRestart={vi.fn()}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('DeviceCodeCard', () => {
  it('renders the user code and verification link while pending', async () => {
    getAuthStatus.mockResolvedValue({ state: 'pending' })
    renderCard()

    expect(screen.getByText('WDJB-MJHT')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open github.com\/login\/device/i })).toHaveAttribute(
      'href',
      'https://github.com/login/device',
    )
  })

  it('polls status at the given interval and keeps polling while pending', async () => {
    getAuthStatus.mockResolvedValue({ state: 'pending' })
    renderCard()

    expect(getAuthStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(getAuthStatus).toHaveBeenCalledTimes(2)
  })

  it('transitions to authorized and advances after the delay', async () => {
    const onAuthorized = vi.fn()
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })
    renderCard({ onAuthorized })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('status')).toHaveTextContent('✓ Connected as octocat')
    expect(onAuthorized).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(onAuthorized).toHaveBeenCalledWith('octocat')
  })

  it('stops polling and offers a retry when the code expires', async () => {
    getAuthStatus.mockResolvedValue({ state: 'expired' })
    const onRestart = vi.fn()
    renderCard({ onRestart })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Code expired.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Get a new code' }))
    expect(onRestart).toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(getAuthStatus).toHaveBeenCalledTimes(1)
  })

  it('shows a denied message with a retry button', async () => {
    getAuthStatus.mockResolvedValue({ state: 'denied' })
    const onRestart = vi.fn()
    renderCard({ onRestart })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Authorization was denied.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRestart).toHaveBeenCalled()
  })

  it('shows a network error with a retry button when polling fails', async () => {
    getAuthStatus.mockRejectedValue(new Error('network down'))
    const onRestart = vi.fn()
    renderCard({ onRestart })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Could not reach the backend. Is it running?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRestart).toHaveBeenCalled()
  })

  it('copies the code and shows Copied for a moment', async () => {
    getAuthStatus.mockResolvedValue({ state: 'pending' })
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
    renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('WDJB-MJHT')
    expect(screen.getByText('Copied')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })
})
