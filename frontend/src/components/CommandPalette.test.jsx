import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CommandPalette from './CommandPalette.jsx'
import AskPage from '../ask/AskPage.jsx'
import { getRepos, postQuery } from '../api.js'
import { NewQuestionProvider } from '../lib/useNewQuestion.js'

vi.mock('../api.js', () => ({
  getRepos: vi.fn(),
  postQuery: vi.fn(),
}))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderPalette({ path = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NewQuestionProvider>
        <CommandPalette />
        <LocationDisplay />
      </NewQuestionProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  getRepos.mockResolvedValue({ repos: [] })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('CommandPalette', () => {
  it('is closed by default', () => {
    renderPalette()

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('opens on Ctrl+K and closes on Escape', () => {
    renderPalette()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('opens on Cmd+K too', () => {
    renderPalette()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
  })

  it('toggles closed when Ctrl+K is pressed again while open', () => {
    renderPalette()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('closes when clicking the backdrop', () => {
    const { container } = renderPalette()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    fireEvent.click(container.querySelector('.fixed.inset-0'))

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('lists the four baseline actions and filters them as the query changes', () => {
    renderPalette()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByRole('option', { name: 'Go to Ask' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Go to Library' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Go to Settings' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'New question' })).toBeInTheDocument()

    const input = screen.getByRole('textbox', { name: 'Command palette search' })
    fireEvent.change(input, { target: { value: 'library' } })

    expect(screen.getByRole('option', { name: 'Go to Library' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Go to Ask' })).not.toBeInTheDocument()
  })

  it('shows a placeholder message when the query matches nothing', () => {
    renderPalette()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    fireEvent.change(screen.getByRole('textbox', { name: 'Command palette search' }), {
      target: { value: 'nonexistent command' },
    })

    expect(screen.getByText('No matching commands')).toBeInTheDocument()
  })

  it('moves the highlighted selection with arrow keys and runs it on Enter', () => {
    renderPalette()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const input = screen.getByRole('textbox', { name: 'Command palette search' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: 'Go to Settings' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getByRole('option', { name: 'Go to Library' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByTestId('location')).toHaveTextContent('/library')
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('resets the query and focuses the input each time it reopens', () => {
    renderPalette()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const firstInput = screen.getByRole('textbox', { name: 'Command palette search' })
    fireEvent.change(firstInput, { target: { value: 'leftover query' } })
    fireEvent.keyDown(window, { key: 'Escape' })

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const secondInput = screen.getByRole('textbox', { name: 'Command palette search' })

    expect(secondInput.value).toBe('')
    expect(secondInput).toHaveFocus()
  })

  describe('navigation actions', () => {
    it('selecting "Go to Library" navigates to /library', () => {
      renderPalette()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      fireEvent.click(screen.getByRole('button', { name: 'Go to Library' }))

      expect(screen.getByTestId('location')).toHaveTextContent('/library')
    })

    it('selecting "Go to Settings" navigates to /settings', () => {
      renderPalette()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      fireEvent.click(screen.getByRole('button', { name: 'Go to Settings' }))

      expect(screen.getByTestId('location')).toHaveTextContent('/settings')
    })

    it('selecting "Go to Ask" navigates to /', () => {
      renderPalette({ path: '/library' })
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      fireEvent.click(screen.getByRole('button', { name: 'Go to Ask' }))

      expect(screen.getByTestId('location').textContent).toBe('/')
    })
  })

  describe('accessibility', () => {
    it('has dialog semantics with aria-modal', () => {
      renderPalette()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      expect(screen.getByRole('dialog', { name: 'Command palette' })).toHaveAttribute('aria-modal', 'true')
    })

    it('returns focus to the element that had focus before opening, after Escape closes it', () => {
      render(
        <MemoryRouter>
          <NewQuestionProvider>
            <button type="button">Trigger</button>
            <CommandPalette />
          </NewQuestionProvider>
        </MemoryRouter>,
      )

      const trigger = screen.getByRole('button', { name: 'Trigger' })
      trigger.focus()
      expect(trigger).toHaveFocus()

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      expect(screen.getByRole('textbox', { name: 'Command palette search' })).toHaveFocus()

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(trigger).toHaveFocus()
    })

    it('wraps Shift+Tab focus from the input to the last focusable element', () => {
      renderPalette()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      const input = screen.getByRole('textbox', { name: 'Command palette search' })
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })

      expect(screen.getByRole('button', { name: 'New question' })).toHaveFocus()
    })

    it('wraps Tab focus from the last focusable element back to the input', () => {
      renderPalette()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      const newQuestionButton = screen.getByRole('button', { name: 'New question' })
      newQuestionButton.focus()
      fireEvent.keyDown(newQuestionButton, { key: 'Tab' })

      expect(screen.getByRole('textbox', { name: 'Command palette search' })).toHaveFocus()
    })

    it('announces the filtered result count via a status region as the query changes', () => {
      renderPalette()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      expect(screen.getByText('4 matching commands')).toBeInTheDocument()

      const input = screen.getByRole('textbox', { name: 'Command palette search' })
      fireEvent.change(input, { target: { value: 'library' } })
      expect(screen.getByText('1 matching command')).toBeInTheDocument()

      fireEvent.change(input, { target: { value: 'nonexistent command' } })
      expect(screen.getByText('0 matching commands')).toBeInTheDocument()
    })
  })

  describe('search past questions', () => {
    it('shows an empty state and makes no network or storage calls', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      renderPalette()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      expect(screen.getByText('No question history yet')).toBeInTheDocument()
      expect(getRepos).not.toHaveBeenCalled()
      expect(getItemSpy).not.toHaveBeenCalled()
      expect(setItemSpy).not.toHaveBeenCalled()

      getItemSpy.mockRestore()
      setItemSpy.mockRestore()
    })
  })

  describe('"New question" action', () => {
    it("clears the Ask page's current conversation when invoked from there", async () => {
      const user = userEvent.setup()
      getRepos.mockResolvedValue({ repos: [{ repo: 'owner/repo-a', indexed_units: 12 }] })
      postQuery.mockResolvedValue({ answer: 'We use OAuth2 for auth.', citations: [], retrieved_count: 0 })

      render(
        <MemoryRouter>
          <NewQuestionProvider>
            <AskPage />
            <CommandPalette />
          </NewQuestionProvider>
        </MemoryRouter>,
      )

      await user.type(await screen.findByLabelText('Ask a question'), 'Why OAuth2?')
      await user.click(screen.getByRole('button', { name: 'Ask' }))
      expect(await screen.findByText('We use OAuth2 for auth.')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      fireEvent.click(screen.getByRole('button', { name: 'New question' }))

      expect(screen.queryByText('We use OAuth2 for auth.')).not.toBeInTheDocument()
      expect(screen.getByText('Ask why something in your codebase is the way it is')).toBeInTheDocument()
    })

    it('is a no-op, not a crash, when no page has registered a handler', () => {
      renderPalette({ path: '/library' })
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      expect(() => fireEvent.click(screen.getByRole('button', { name: 'New question' }))).not.toThrow()
    })
  })
})
