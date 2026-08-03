import { useLayoutEffect, useRef, useState } from 'react'

function ChatInput({ onSubmit, disabled, initialValue = '' }) {
  const [value, setValue] = useState(initialValue)
  const textareaRef = useRef(null)

  // No fixed textarea height (UI-DESIGN.md's mobile fix) — grow with
  // content up to a scrollable cap instead of clipping wrapped text at
  // the single `rows={1}` line, which is what made the bar look clipped
  // on narrow viewports where far more questions wrap to multiple lines.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  function submit() {
    const question = value.trim()
    if (!question || disabled) return
    onSubmit(question)
    setValue('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    submit()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 sm:gap-4 bg-panel p-3 sm:p-4 rounded-xl"
    >
      <label htmlFor="chat-input" className="sr-only">
        Ask a question
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Ask why something in your codebase is the way it is"
        className="flex-1 min-w-0 resize-none overflow-y-auto max-h-40 rounded-lg bg-surface text-ink text-base p-4 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      <button
        type="submit"
        aria-label="Ask"
        disabled={disabled}
        className="rounded-lg bg-accent text-accent-ink font-ui text-sm font-semibold px-4 py-2 disabled:opacity-50"
      >
        Ask
      </button>
    </form>
  )
}

export default ChatInput
