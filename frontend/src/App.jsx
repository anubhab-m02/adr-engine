import { useEffect, useState } from 'react'
import { getRepos, postQuery } from './api.js'
import ChatInput from './components/ChatInput.jsx'
import MessageList from './components/MessageList.jsx'
import RepoFilter from './components/RepoFilter.jsx'

const EXAMPLE_QUESTIONS = [
  'Why is authentication done this way?',
  'What alternatives did we consider for the database?',
  'Who made the decision to use Redis, and when?',
]

function App() {
  const [repos, setRepos] = useState(undefined)
  const [selectedRepos, setSelectedRepos] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [chatKey, setChatKey] = useState(0)
  const [prefill, setPrefill] = useState('')

  useEffect(() => {
    let cancelled = false

    getRepos()
      .then((result) => {
        if (cancelled) return
        setRepos(result.repos)
        setSelectedRepos(result.repos.map((repo) => repo.repo))
      })
      .catch(() => {
        if (cancelled) return
        setRepos([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function runQuery(question) {
    setLoading(true)
    try {
      const result = await postQuery({ question, repos: selectedRepos })
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', type: 'answer', answer: result.answer, citations: result.citations },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', type: 'error', message: err.message, onRetry: () => retry(question) },
      ])
    } finally {
      setLoading(false)
    }
  }

  function retry(question) {
    setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', type: 'loading' }])
    runQuery(question)
  }

  function handleAsk(question) {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant', type: 'loading' },
    ])
    runQuery(question)
  }

  function handleChipClick(question) {
    setPrefill(question)
    setChatKey((key) => key + 1)
  }

  return (
    <div className="min-h-svh bg-surface text-ink flex flex-col">
      <header className="h-14 shrink-0 bg-panel flex items-center justify-between px-4">
        <span className="text-lg font-semibold">adr-engine</span>
        <RepoFilter repos={repos} selected={selectedRepos} onChange={setSelectedRepos} />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-base text-ink-muted">
              Ask why something in your codebase is the way it is
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {EXAMPLE_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleChipClick(question)}
                  className="rounded-lg border border-transparent bg-panel text-ink text-sm px-4 py-2 hover:border-accent"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <MessageList messages={messages} />
          </div>
        )}
      </main>

      <div className="sticky bottom-0 shrink-0 bg-panel px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput key={chatKey} initialValue={prefill} onSubmit={handleAsk} disabled={loading} />
        </div>
      </div>
    </div>
  )
}

export default App
