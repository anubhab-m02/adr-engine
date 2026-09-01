import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getConfig, patchConfig } from '../api.js'
import ModelsSection from './ModelsSection.jsx'

vi.mock('../api.js', () => ({ getConfig: vi.fn(), patchConfig: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
})

describe('ModelsSection', () => {
  it('renders fields from the current config', async () => {
    getConfig.mockResolvedValue({
      ollama_host: 'http://localhost:11434',
      ollama_extraction_model: 'llama3',
      ollama_embedding_model: 'nomic-embed-text',
    })

    render(<ModelsSection />)

    expect(await screen.findByLabelText('Ollama host')).toHaveValue('http://localhost:11434')
    expect(screen.getByLabelText('Extraction model')).toHaveValue('llama3')
    expect(screen.getByLabelText('Embedding model')).toHaveValue('nomic-embed-text')
  })

  it('save calls PATCH /config with the updated model settings', async () => {
    getConfig.mockResolvedValue({
      ollama_host: 'http://localhost:11434',
      ollama_extraction_model: 'llama3',
      ollama_embedding_model: 'nomic-embed-text',
    })
    patchConfig.mockResolvedValue({})

    render(<ModelsSection />)
    await screen.findByLabelText('Ollama host')

    fireEvent.change(screen.getByLabelText('Ollama host'), { target: { value: 'http://localhost:9999' } })
    fireEvent.change(screen.getByLabelText('Extraction model'), { target: { value: 'mistral' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(patchConfig).toHaveBeenCalledWith({
      ollama_host: 'http://localhost:9999',
      ollama_extraction_model: 'mistral',
      ollama_embedding_model: 'nomic-embed-text',
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('shows the effective default as a placeholder, not a value, when models are unconfigured', async () => {
    getConfig.mockResolvedValue({
      ollama_host: 'http://localhost:11434',
      ollama_extraction_model: null,
      ollama_embedding_model: null,
    })

    render(<ModelsSection />)

    expect(await screen.findByLabelText('Extraction model')).toHaveValue('')
    expect(screen.getByLabelText('Extraction model')).toHaveAttribute('placeholder', 'phi4-mini (default)')
    expect(screen.getByLabelText('Embedding model')).toHaveValue('')
    expect(screen.getByLabelText('Embedding model')).toHaveAttribute('placeholder', 'nomic-embed-text (default)')
  })

  it('saving without typing anything does not submit the placeholder text', async () => {
    getConfig.mockResolvedValue({
      ollama_host: 'http://localhost:11434',
      ollama_extraction_model: null,
      ollama_embedding_model: null,
    })
    patchConfig.mockResolvedValue({})

    render(<ModelsSection />)
    await screen.findByLabelText('Extraction model')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(patchConfig).toHaveBeenCalledWith({
      ollama_host: 'http://localhost:11434',
      ollama_extraction_model: '',
      ollama_embedding_model: '',
    })
  })

  it('shows an inline error when the save fails', async () => {
    getConfig.mockResolvedValue({
      ollama_host: 'http://localhost:11434',
      ollama_extraction_model: 'llama3',
      ollama_embedding_model: 'nomic-embed-text',
    })
    patchConfig.mockRejectedValue(new Error('invalid host'))

    render(<ModelsSection />)
    await screen.findByLabelText('Ollama host')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save model settings. Check them and try again.',
    )
  })
})
