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

  it('applies higher heat intensity to a path with a higher decision count', () => {
    const counts = { 'backend/auth.py': 8, 'backend/models.py': 2, 'frontend/src/api.js': 0 }
    render(<FileTree paths={PATHS} counts={counts} />)

    const auth = screen.getByText('auth.py')
    const models = screen.getByText('models.py')
    expect(auth).toHaveClass('heat')
    expect(models).toHaveClass('heat')

    const authIntensity = parseInt(auth.style.getPropertyValue('--heat-intensity'), 10)
    const modelsIntensity = parseInt(models.style.getPropertyValue('--heat-intensity'), 10)
    expect(authIntensity).toBeGreaterThan(modelsIntensity)
  })

  it('applies no highlight to a path with zero decisions', () => {
    const counts = { 'backend/auth.py': 8, 'backend/models.py': 2, 'frontend/src/api.js': 0 }
    render(<FileTree paths={PATHS} counts={counts} />)

    const api = screen.getByText('api.js')
    expect(api).not.toHaveClass('heat')
    expect(api.style.getPropertyValue('--heat-intensity')).toBe('')
  })

  it('colors a directory by its aggregated descendant count', () => {
    const counts = { 'backend/auth.py': 8, 'backend/models.py': 2, 'frontend/src/api.js': 0 }
    render(<FileTree paths={PATHS} counts={counts} />)

    const backend = screen.getByRole('button', { name: /backend/ })
    const src = screen.getByRole('button', { name: /src/ })
    expect(backend).toHaveClass('heat')
    expect(src).not.toHaveClass('heat')
  })
})
