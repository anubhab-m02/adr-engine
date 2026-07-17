import { useState } from 'react'

function ChatInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('')

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
      className="flex items-end gap-4 bg-panel p-4 rounded-xl"
    >
      <label htmlFor="chat-input" className="sr-only">
        Ask a question
      </label>
      <textarea
        id="chat-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Ask why something in your codebase is the way it is"
        className="flex-1 resize-none rounded-lg bg-surface text-ink text-base p-4 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      <button
        type="submit"
        aria-label="Ask"
        disabled={disabled}
        className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
      >
        Ask
      </button>
    </form>
  )
}

export default ChatInput
