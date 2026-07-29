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
    getConfig.mockResolvedValue({ chroma_data_dir: '/home/user/.adr-engine/chroma' })

    render(<DataSection />)

    expect(await screen.findByText('/home/user/.adr-engine/chroma')).toBeInTheDocument()
  })

  it('requires confirmation before calling the clear-index API', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data' })

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    expect(clearIndex).not.toHaveBeenCalled()
    expect(screen.getByText(/Clear the index\?/)).toBeInTheDocument()
  })

  it('confirming calls DELETE /repos and shows a cleared message', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data' })
    clearIndex.mockResolvedValue(null)

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))

    expect(clearIndex).toHaveBeenCalled()
    expect(await screen.findByText('Index cleared.')).toBeInTheDocument()
  })

  it('cancel dismisses the confirmation without calling the API', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data' })

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(clearIndex).not.toHaveBeenCalled()
    expect(screen.queryByText(/Clear the index\?/)).not.toBeInTheDocument()
  })

  it('shows an inline error when clearing fails', async () => {
    getConfig.mockResolvedValue({ chroma_data_dir: '/data' })
    clearIndex.mockRejectedValue(new Error('boom'))

    render(<DataSection />)
    await screen.findByText('/data')

    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear index' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not clear the index.')
  })
})
