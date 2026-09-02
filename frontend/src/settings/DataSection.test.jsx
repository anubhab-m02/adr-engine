import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearIndex, getConfig } from '../api.js'
import DataSection from './DataSection.jsx'

vi.mock('../api.js', () => ({ getConfig: vi.fn(), clearIndex: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
})

describe('DataSection', () => {
  it('renders the index location from config', async () => {
    getConfig.mockResolvedValue({
      chroma_data_dir: '/home/user/.adr-engine/chroma',
      decision_count: 42,
    })

    render(<DataSection />)

    expect(await screen.findByText('/home/user/.adr-engine/chroma')).toBeInTheDocument()
  })

  it('renders the total decision count from config', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data', decision_count: 42 })

    render(<DataSection />)

    expect(await screen.findByText('42 indexed decisions')).toBeInTheDocument()
  })

  it('uses singular copy for a single indexed decision', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data', decision_count: 1 })

    render(<DataSection />)

    expect(await screen.findByText('1 indexed decision')).toBeInTheDocument()
  })

  it('requires confirmation before calling the clear-index API', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data', decision_count: 42 })

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    expect(clearIndex).not.toHaveBeenCalled()
    expect(screen.getByText(/Clear the index\?/)).toBeInTheDocument()
  })

  it('confirming calls DELETE /repos and shows a cleared message', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data', decision_count: 42 })
    clearIndex.mockResolvedValue(null)

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))

    expect(clearIndex).toHaveBeenCalled()
    expect(await screen.findByText('Index cleared.')).toBeInTheDocument()
  })

  it('cancel dismisses the confirmation without calling the API', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data', decision_count: 42 })

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(clearIndex).not.toHaveBeenCalled()
    expect(screen.queryByText(/Clear the index\?/)).not.toBeInTheDocument()
  })

  it('shows an inline error when clearing fails', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data', decision_count: 42 })
    clearIndex.mockRejectedValue(new Error('boom'))

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not clear the index.')
  })
})
