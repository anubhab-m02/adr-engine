import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { patchConfig } from '../api.js'
import GeminiKeyStep from './GeminiKeyStep.jsx'

vi.mock('../api.js', () => ({ patchConfig: vi.fn() }))

beforeEach(() => {
  patchConfig.mockReset()
})

describe('GeminiKeyStep', () => {
  it('submits the key via PATCH /config and calls onComplete', async () => {
    patchConfig.mockResolvedValue({})
    const onComplete = vi.fn()

    render(<GeminiKeyStep onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-test-123' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(patchConfig).toHaveBeenCalledWith({ gemini_api_key: 'sk-test-123' })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('skipping calls onComplete without calling PATCH', () => {
    const onComplete = vi.fn()

    render(<GeminiKeyStep onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(patchConfig).not.toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('disables Save until a key is entered', () => {
    render(<GeminiKeyStep onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-test-123' } })
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('shows an inline error and keeps the key on a failed save, without calling onComplete', async () => {
    patchConfig.mockRejectedValue(new Error('invalid key'))
    const onComplete = vi.fn()

    render(<GeminiKeyStep onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-test-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the key. Check it and try again.')
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Gemini API key')).toHaveValue('sk-test-123')
  })
})
