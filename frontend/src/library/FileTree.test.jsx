import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import FileTree from './FileTree.jsx'

const PATHS = ['backend/auth.py', 'backend/models.py', 'frontend/src/api.js']

describe('FileTree', () => {
  it('nests files under their directories', () => {
    render(<FileTree paths={PATHS} />)

    const backend = screen.getByRole('button', { name: /backend/ })
    const backendFiles = within(backend.closest('li')).getAllByText(/\.py$/)
    expect(backendFiles.map((f) => f.textContent)).toEqual(['auth.py', 'models.py'])

    const src = screen.getByRole('button', { name: /src/ })
    const srcFiles = within(src.closest('li')).getAllByText(/\.js$/)
    expect(srcFiles.map((f) => f.textContent)).toEqual(['api.js'])
  })

  it('expands and collapses a directory on click', async () => {
    const user = userEvent.setup()
    render(<FileTree paths={PATHS} />)

    const backend = screen.getByRole('button', { name: /backend/ })
    expect(backend).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('auth.py')).toBeInTheDocument()

    await user.click(backend)
    expect(backend).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('auth.py')).not.toBeInTheDocument()

    await user.click(backend)
    expect(backend).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('auth.py')).toBeInTheDocument()
  })
})
