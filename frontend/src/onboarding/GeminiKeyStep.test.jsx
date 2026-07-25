import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { patchConfig } from '../api.js'
import GeminiKeyStep from './GeminiKeyStep.jsx'

vi.mock('../api.js', () => ({ patchConfig: vi.fn() }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function renderStep() {
  return render(<GeminiKeyStep />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  navigateMock.mockClear()
  patchConfig.mockReset()
})

describe('GeminiKeyStep', () => {
  it('submits the key via PATCH /config and navigates to /', async () => {
    patchConfig.mockResolvedValue({})

    renderStep()
    fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-test-123' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(patchConfig).toHaveBeenCalledWith({ gemini_api_key: 'sk-test-123' })
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('skipping navigates to / without calling PATCH', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(patchConfig).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('disables Save until a key is entered', () => {
    renderStep()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-test-123' } })
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })
})
