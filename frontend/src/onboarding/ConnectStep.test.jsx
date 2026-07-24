import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthStatus, startDeviceFlow } from '../api.js'
import ConnectStep from './ConnectStep.jsx'

vi.mock('../api.js', () => ({ startDeviceFlow: vi.fn(), getAuthStatus: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('ConnectStep', () => {
  it('starts the device flow on mount and renders the returned code', async () => {
    startDeviceFlow.mockResolvedValue({
      user_code: 'WDJB-MJHT',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    })
    getAuthStatus.mockResolvedValue({ state: 'pending' })

    render(<ConnectStep onAuthorized={vi.fn()} />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(startDeviceFlow).toHaveBeenCalledTimes(1)
    expect(screen.getByText('WDJB-MJHT')).toBeInTheDocument()
  })

  it('shows an error with a retry when starting the device flow fails', async () => {
    startDeviceFlow.mockRejectedValue(new Error('boom'))

    render(<ConnectStep onAuthorized={vi.fn()} />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Could not start GitHub sign-in.')).toBeInTheDocument()

    startDeviceFlow.mockResolvedValue({
      user_code: 'NEW-CODE',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    })
    getAuthStatus.mockResolvedValue({ state: 'pending' })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(startDeviceFlow).toHaveBeenCalledTimes(2)
    expect(screen.getByText('NEW-CODE')).toBeInTheDocument()
  })

  it('advances to the next step once the device is authorized', async () => {
    const onAuthorized = vi.fn()
    startDeviceFlow.mockResolvedValue({
      user_code: 'WDJB-MJHT',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    })
    getAuthStatus.mockResolvedValue({ state: 'authorized', login: 'octocat' })

    render(<ConnectStep onAuthorized={onAuthorized} />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(onAuthorized).toHaveBeenCalledWith('octocat')
  })
})
