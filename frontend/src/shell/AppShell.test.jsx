import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
    fireEvent.click(screen.getByRole('button', { name: 'Exit focus mode' }))

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

  it('still renders the skip link in focus mode', () => {
    renderShell()

    openPalette()
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))

    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument()
  })
})
