import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getConfig, patchConfig } from '../api.js'
import GeminiSection from './GeminiSection.jsx'

vi.mock('../api.js', () => ({ getConfig: vi.fn(), patchConfig: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
})

describe('GeminiSection', () => {
  it('renders the empty state with no masked key when none is set', async () => {
    getConfig.mockResolvedValue({ gemini_api_key: null })

    render(<GeminiSection />)

    expect(await screen.findByLabelText('Gemini API key')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('renders an existing key masked', async () => {
    getConfig.mockResolvedValue({ gemini_api_key: 'gk_1…cdef' })

    render(<GeminiSection />)

    expect(await screen.findByText('gk_1…cdef')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('save calls PATCH /config with the new key', async () => {
    getConfig.mockResolvedValue({ gemini_api_key: null })
    patchConfig.mockResolvedValue({ gemini_api_key: 'gk_1…cdef' })

    render(<GeminiSection />)
    await screen.findByLabelText('Gemini API key')

    fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-test-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(patchConfig).toHaveBeenCalledWith({ gemini_api_key: 'sk-test-123' })
    expect(await screen.findByText('gk_1…cdef')).toBeInTheDocument()
  })

  it('shows an inline error when the save fails', async () => {
    getConfig.mockResolvedValue({ gemini_api_key: null })
    patchConfig.mockRejectedValue(new Error('invalid key'))

    render(<GeminiSection />)
    await screen.findByLabelText('Gemini API key')

    fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-test-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the key. Check it and try again.')
  })

  it('remove asks for inline confirmation, then clears the key via PATCH with an empty value', async () => {
    getConfig.mockResolvedValue({ gemini_api_key: 'gk_1…cdef' })
    patchConfig.mockResolvedValue({})

    render(<GeminiSection />)
    await screen.findByText('gk_1…cdef')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(patchConfig).not.toHaveBeenCalled()
    expect(screen.getByText(/Remove the Gemini key\?/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(patchConfig).toHaveBeenCalledWith({ gemini_api_key: null })
    expect(await screen.findByLabelText('Gemini API key')).toBeInTheDocument()
    expect(screen.queryByText('gk_1…cdef')).not.toBeInTheDocument()
  })

  it('cancel dismisses the remove confirmation without calling PATCH', async () => {
    getConfig.mockResolvedValue({ gemini_api_key: 'gk_1…cdef' })

    render(<GeminiSection />)
    await screen.findByText('gk_1…cdef')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(patchConfig).not.toHaveBeenCalled()
    expect(screen.getByText('gk_1…cdef')).toBeInTheDocument()
  })
})
