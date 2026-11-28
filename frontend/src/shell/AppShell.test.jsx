import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getIngestStatus } from '../api.js'
import { IngestStatusProvider } from '../lib/useIngestStatus.js'
import { NewQuestionProvider } from '../lib/useNewQuestion.js'
import AppShell from './AppShell.jsx'

vi.mock('../api.js', () => ({ getIngestStatus: vi.fn() }))

function renderShell() {
  return render(
    <MemoryRouter>
      <IngestStatusProvider>
        <NewQuestionProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<div>Page content</div>} />
            </Route>
          </Routes>
        </NewQuestionProvider>
      </IngestStatusProvider>
    </MemoryRouter>,
  )
}

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
}

beforeEach(() => {
  getIngestStatus.mockResolvedValue({ active: false, repos: [] })
  localStorage.clear()
})

afterEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
})

describe('AppShell', () => {
  it('renders TopNav by default', () => {
    renderShell()

    expect(screen.getByText('adr-engine')).toBeInTheDocument()
  })

  it('hides TopNav once focus mode is toggled on from the command palette', () => {
    renderShell()

    openPalette()
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))

    expect(screen.queryByText('adr-engine')).not.toBeInTheDocument()
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('shows TopNav again once focus mode is toggled back off', () => {
    renderShell()

    openPalette()
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))
    openPalette()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Exit focus mode' }))

    expect(screen.getByText('adr-engine')).toBeInTheDocument()
  })

  it('renders exactly one main landmark', () => {
    renderShell()

    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('makes the skip link the first tab stop, targeting the main landmark', async () => {
    renderShell()

    await userEvent.tab()

    const link = screen.getByRole('link', { name: 'Skip to content' })
    expect(link).toHaveFocus()
    expect(link).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })

  it('does not steal focus on initial render', () => {
    renderShell()

    expect(screen.getByRole('main')).not.toHaveFocus()
  })

  it('moves focus to the main landmark after a route change', async () => {
    render(
      <MemoryRouter>
        <IngestStatusProvider>
          <NewQuestionProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Link to="/other">Go other</Link>} />
                <Route path="/other" element={<div>Other content</div>} />
              </Route>
            </Routes>
          </NewQuestionProvider>
        </IngestStatusProvider>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('link', { name: 'Go other' }))

    expect(await screen.findByText('Other content')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('shows an Exit focus mode button only while focus mode is on, and it restores TopNav', () => {
    renderShell()
    expect(screen.queryByRole('button', { name: 'Exit focus mode' })).not.toBeInTheDocument()

    openPalette()
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))
    const exit = screen.getByRole('button', { name: 'Exit focus mode' })
    expect(exit).toBeVisible()

    fireEvent.click(exit)

    expect(screen.getByText('adr-engine')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exit focus mode' })).not.toBeInTheDocument()
  })

  it('still renders the skip link in focus mode', () => {
    renderShell()

    openPalette()
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))

    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument()
  })
})
