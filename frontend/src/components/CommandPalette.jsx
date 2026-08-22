// The empty shell for Track B's command palette: a global Cmd/Ctrl+K
// overlay with a filtered, arrow-navigable action list. Mounted once in
// AppShell (wraps every authenticated route) so the shortcut works from
// anywhere. `ACTIONS` is a static array on purpose — a dynamic
// registry is speculative generality until a real second consumer needs
// to register actions of its own; the navigation actions land here in a
// later issue.
import { useEffect, useRef, useState } from 'react'

const ACTIONS = []

function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleKeyDown(event) {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isToggle) {
        event.preventDefault()
        setOpen((current) => !current)
      } else if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlightedIndex(0)
    inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const filtered = ACTIONS.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()))

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Command palette"
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
      </div>
    </div>
  )
}

export default CommandPalette
