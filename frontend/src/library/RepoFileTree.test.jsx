import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RepoFileTree from './RepoFileTree.jsx'
import { getDecisionsByPath } from '../api.js'

vi.mock('../api.js', () => ({ getDecisionsByPath: vi.fn() }))

afterEach(() => vi.resetAllMocks())

function renderTree() {
  return render(
    <MemoryRouter>
      <RepoFileTree repo="owner/repo" />
    </MemoryRouter>,
  )
}

describe('RepoFileTree', () => {
  it('fetches the path counts for the repo and renders the tree', async () => {
    getDecisionsByPath.mockResolvedValue({ paths: { 'src/app.py': 3 } })
    renderTree()
    expect(await screen.findByText('app.py')).toBeInTheDocument()
    expect(getDecisionsByPath).toHaveBeenCalledWith({ repo: 'owner/repo' })
  })

  it('shows an empty state when no paths are indexed', async () => {
    getDecisionsByPath.mockResolvedValue({ paths: {} })
    renderTree()
    expect(await screen.findByText('No decisions indexed yet.')).toBeInTheDocument()
  })

  it('shows an error when the request fails', async () => {
    getDecisionsByPath.mockRejectedValue(new Error('boom'))
    renderTree()
    expect(await screen.findByText("Couldn't load the file tree.")).toBeInTheDocument()
  })
})
