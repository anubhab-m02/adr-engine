import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FileTree from './FileTree.jsx'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

afterEach(() => {
  vi.resetAllMocks()
})

const PATHS = ['backend/auth.py', 'backend/models.py', 'frontend/src/api.js']

function renderFileTree(props) {
  return render(<FileTree paths={PATHS} {...props} />, { wrapper: MemoryRouter })
}

describe('FileTree', () => {
  it('nests files under their directories', () => {
    renderFileTree()

    const backend = screen.getByRole('button', { name: 'backend' })
    const backendFiles = within(backend.closest('li')).getAllByText(/\.py$/)
    expect(backendFiles.map((f) => f.textContent)).toEqual(['auth.py', 'models.py'])

    const src = screen.getByRole('button', { name: 'src' })
    const srcFiles = within(src.closest('li')).getAllByText(/\.js$/)
    expect(srcFiles.map((f) => f.textContent)).toEqual(['api.js'])
  })

  it('expands and collapses a directory via its caret, independent of the name click target', async () => {
    const user = userEvent.setup()
    renderFileTree()

    const toggle = screen.getByRole('button', { name: 'Collapse backend' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('auth.py')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Expand backend' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('auth.py')).not.toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Expand backend' }))
    expect(screen.getByRole('button', { name: 'Collapse backend' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('auth.py')).toBeInTheDocument()
  })

  it('clicking a directory name navigates to Ask with a question pre-filled and scoped to that path', async () => {
    const user = userEvent.setup()
    renderFileTree()

    await user.click(screen.getByRole('button', { name: 'backend' }))

    expect(navigateMock).toHaveBeenCalledWith('/', {
      state: { prefillQuestion: 'Why is `backend` the way it is?' },
    })
  })

  it('clicking a file name navigates to Ask with a question pre-filled and scoped to that file', async () => {
    const user = userEvent.setup()
    renderFileTree()

    await user.click(screen.getByRole('button', { name: 'auth.py' }))

    expect(navigateMock).toHaveBeenCalledWith('/', {
      state: { prefillQuestion: 'Why is `backend/auth.py` the way it is?' },
    })
  })

  it('applies higher heat intensity to a path with a higher decision count', () => {
    const counts = { 'backend/auth.py': 8, 'backend/models.py': 2, 'frontend/src/api.js': 0 }
    renderFileTree({ counts })

    const auth = screen.getByRole('button', { name: 'auth.py' })
    const models = screen.getByRole('button', { name: 'models.py' })
    expect(auth).toHaveClass('heat')
    expect(models).toHaveClass('heat')

    const authIntensity = parseInt(auth.style.getPropertyValue('--heat-intensity'), 10)
    const modelsIntensity = parseInt(models.style.getPropertyValue('--heat-intensity'), 10)
    expect(authIntensity).toBeGreaterThan(modelsIntensity)
  })

  it('applies no highlight to a path with zero decisions', () => {
    const counts = { 'backend/auth.py': 8, 'backend/models.py': 2, 'frontend/src/api.js': 0 }
    renderFileTree({ counts })

    const api = screen.getByRole('button', { name: 'api.js' })
    expect(api).not.toHaveClass('heat')
    expect(api.style.getPropertyValue('--heat-intensity')).toBe('')
  })

  it('colors a directory by its aggregated descendant count', () => {
    const counts = { 'backend/auth.py': 8, 'backend/models.py': 2, 'frontend/src/api.js': 0 }
    renderFileTree({ counts })

    const backend = screen.getByRole('button', { name: 'backend' })
    const src = screen.getByRole('button', { name: 'src' })
    expect(backend).toHaveClass('heat')
    expect(src).not.toHaveClass('heat')
  })
})
