// Track B's command palette: a global Cmd/Ctrl+K overlay with a
// filtered, arrow-navigable action list. Mounted once in AppShell (wraps
// every authenticated route) so the shortcut works from anywhere. The
// action list is a static array built from four baseline actions on
// purpose — a dynamic registry is speculative generality until a real
// second consumer needs to register actions of its own. AppShell is the
// one exception: it contributes the focus-mode toggle via props, since
// the palette has no other way to reach AppShell's own render state.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNewQuestion } from '../lib/useNewQuestion.js'

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function CommandPalette({ focusModeActive = false, onToggleFocusMode } = {}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const shortcutsCloseRef = useRef(null)
  const shortcutsPreviousFocusRef = useRef(null)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const navigate = useNavigate()
  const requestNewQuestion = useNewQuestion()

  const actions = useMemo(() => {
    const baseline = [
      { id: 'go-ask', label: 'Go to Ask', run: () => navigate('/') },
      { id: 'go-library', label: 'Go to Library', run: () => navigate('/library') },
      { id: 'go-settings', label: 'Go to Settings', run: () => navigate('/settings') },
      { id: 'new-question', label: 'New question', run: () => requestNewQuestion() },
      { id: 'keyboard-shortcuts', label: 'Keyboard shortcuts', run: () => setShortcutsOpen(true) },
    ]
    if (!onToggleFocusMode) return baseline
    return [
      ...baseline,
      {
        id: 'toggle-focus-mode',
        label: focusModeActive ? 'Exit focus mode' : 'Enter focus mode',
        run: onToggleFocusMode,
      },
    ]
  }, [navigate, requestNewQuestion, focusModeActive, onToggleFocusMode])

  useEffect(() => {
    function handleKeyDown(event) {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isToggle) {
        event.preventDefault()
        setShortcutsOpen(false)
        setOpen((current) => !current)
      } else if (event.key === 'Escape') {
        setOpen(false)
        setShortcutsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement
    setQuery('')
    setHighlightedIndex(0)
    inputRef.current?.focus()
    return () => {
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open])

  // Declared after the palette's focus effect so that, when an action closes
  // the palette and opens this dialog in one commit, the palette's cleanup
  // restores the original focus first and we capture that as the return target.
  useEffect(() => {
    if (!shortcutsOpen) return
    shortcutsPreviousFocusRef.current = document.activeElement
    shortcutsCloseRef.current?.focus()
    return () => {
      shortcutsPreviousFocusRef.current?.focus?.()
    }
  }, [shortcutsOpen])

  const shortcutsDialog = shortcutsOpen && (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 pt-[15vh]"
      onClick={() => setShortcutsOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
        onKeyDown={(event) => {
          // The Close button is the only focusable element: keep focus inside.
          if (event.key === 'Tab') {
            event.preventDefault()
            shortcutsCloseRef.current?.focus()
          }
        }}
        className="w-full max-w-lg mx-4 rounded-xl bg-panel shadow-lg p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-ui text-base text-ink">Keyboard shortcuts</h2>
        <ul className="mt-3 space-y-2 text-sm font-ui text-ink">
          <li><kbd>Cmd/Ctrl+K</kbd> — open or close the command palette</li>
          <li><kbd>Escape</kbd> — close the command palette or this dialog</li>
          <li><kbd>↑</kbd> / <kbd>↓</kbd> — move through palette commands</li>
          <li><kbd>Enter</kbd> — run the highlighted palette command</li>
        </ul>
        <button
          ref={shortcutsCloseRef}
          type="button"
          onClick={() => setShortcutsOpen(false)}
          className="mt-4 font-ui text-sm text-ink-muted hover:text-ink underline"
        >
          Close
        </button>
      </div>
    </div>
  )

  if (!open) return shortcutsDialog || null

  const filtered = actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()))

  function runAction(index) {
    const action = filtered[index]
    if (!action) return
    action.run()
    setOpen(false)
  }

  function handleQueryChange(event) {
    setQuery(event.target.value)
    setHighlightedIndex(0)
  }

  function handleInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.min(current + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runAction(highlightedIndex)
    }
  }

  function handleDialogKeyDown(event) {
    if (event.key !== 'Tab') return
    const focusable = getFocusableElements(dialogRef.current)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    } else if (document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-lg mx-4 rounded-xl bg-panel shadow-lg overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleInputKeyDown}
          placeholder="Type a command…"
          aria-label="Command palette search"
          className="w-full font-ui text-base text-ink bg-transparent px-4 py-3 border-b border-surface focus:outline-none"
        />
        <p role="status" aria-live="polite" className="sr-only">
          {filtered.length} matching command{filtered.length === 1 ? '' : 's'}
        </p>
        <ul role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && <li className="px-4 py-2 text-sm text-ink-muted">No matching commands</li>}
          {filtered.map((action, index) => (
            <li key={action.id} role="option" aria-selected={index === highlightedIndex}>
              <button
                type="button"
                onClick={() => runAction(index)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-4 py-2 text-sm font-ui ${
                  index === highlightedIndex ? 'bg-highlight text-ink' : 'text-ink'
                }`}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-surface px-4 py-3">
          <h2 className="text-xs font-ui uppercase tracking-wide text-ink-muted">Past questions</h2>
          <p className="mt-1 text-sm text-ink-muted">No question history yet</p>
        </div>
      </div>
    </div>
    {shortcutsDialog}
    </>
  )
}

export default CommandPalette
