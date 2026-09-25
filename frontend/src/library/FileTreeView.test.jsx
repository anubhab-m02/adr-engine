import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FileTreeView from './FileTreeView.jsx'
import { getDecisionsByPath } from '../api.js'

vi.mock('../api.js', () => ({
  getDecisionsByPath: vi.fn(),
}))

afterEach(() => {
  vi.resetAllMocks()
})

function renderFileTreeView(props) {
  return render(<FileTreeView repo="owner/repo" {...props} />, { wrapper: MemoryRouter })
}

describe('FileTreeView', () => {
  it('shows a loading state while the fetch is in flight', () => {
    getDecisionsByPath.mockReturnValue(new Promise(() => {}))

    renderFileTreeView()

    expect(screen.getByText('Loading files…')).toBeInTheDocument()
  })

  it('fetches by-path counts for the given repo and renders a FileTree from them', async () => {
    getDecisionsByPath.mockResolvedValue({
      paths: { 'backend/auth.py': 3, 'backend/models.py': 1 },
    })

    renderFileTreeView()

    expect(await screen.findByRole('button', { name: 'backend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'auth.py' })).toBeInTheDocument()
    expect(getDecisionsByPath).toHaveBeenCalledWith({ repo: 'owner/repo' })
  })

  it('shows an empty state when the repo has no indexed decisions yet', async () => {
    getDecisionsByPath.mockResolvedValue({ paths: {} })

    renderFileTreeView()

    expect(await screen.findByText('No decisions indexed yet.')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    getDecisionsByPath.mockRejectedValue(new Error('network error'))

    renderFileTreeView()

    expect(await screen.findByText("Couldn't load the file tree.")).toBeInTheDocument()
  })
})
