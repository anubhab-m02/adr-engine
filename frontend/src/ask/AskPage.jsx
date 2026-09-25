import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAuthStatus, getRepos, postQuery } from '../api.js'
import ChatInput from '../components/ChatInput.jsx'
import MessageList from '../components/MessageList.jsx'
import RepoFilter from '../components/RepoFilter.jsx'
import { useRegisterNewQuestionHandler } from '../lib/useNewQuestion.js'

const EXAMPLE_QUESTIONS = [
  'Why is authentication done this way?',
  'What alternatives did we consider for the database?',
  'Who made the decision to use Redis, and when?',
]

// Per-session dismissal, same mechanism as SourcesView's degraded-mode
// banner: sessionStorage, not localStorage, since this is a quiet nudge
// rather than a permanent user preference.
const AUTH_BANNER_DISMISSED_KEY = 'askPageAuthExpiredBannerDismissed'

// Repos aren't loaded yet, failed to load, or none are indexed — the
// static fallback list, not an empty chip row. There's no per-repo
// "topic" signal yet (that's later decision-browser work), so the
// generated question stays generic rather than naming a topic the repo
// may not actually have decisions about.
function exampleQuestions(repos) {
  if (!Array.isArray(repos) || repos.length === 0) return EXAMPLE_QUESTIONS
  return repos.slice(0, 3).map(({ repo }) => {
    const shortName = repo.includes('/') ? repo.split('/')[1] : repo
    return `Why is ${shortName} built this way?`
  })
}

function AskPage() {
  const [repos, setRepos] = useState(undefined)
  const [selectedRepos, setSelectedRepos] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [chatKey, setChatKey] = useState(0)
  const [prefill, setPrefill] = useState('')
  const [authExpired, setAuthExpired] = useState(false)
  const [authBannerDismissed, setAuthBannerDismissed] = useState(
    () => sessionStorage.getItem(AUTH_BANNER_DISMISSED_KEY) === 'true',
  )

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
        setRepos('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // UI-DESIGN.md's Settings/GitHub spec: an expired connection also
  // triggers a quiet banner here, since this page is where indexing
  // silently going stale would otherwise go unnoticed. Independent of
  // GitHubSection.jsx's own status check — no shared auth-status context
  // exists yet for this cross-page concern.
  useEffect(() => {
    let cancelled = false

    getAuthStatus()
      .then((result) => {
        if (!cancelled) setAuthExpired(result.state === 'expired')
      })
      .catch(() => {
        if (!cancelled) setAuthExpired(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  function dismissAuthBanner() {
    sessionStorage.setItem(AUTH_BANNER_DISMISSED_KEY, 'true')
    setAuthBannerDismissed(true)
  }

  function replaceLastMessage(message) {
    setMessages((prev) => [...prev.slice(0, -1), message])
  }

  async function runQuery(question) {
    setLoading(true)
    try {
      const result = await postQuery({ question, repos: selectedRepos })
      replaceLastMessage({
        role: 'assistant',
        type: 'answer',
        mode: result.mode,
        answer: result.answer,
        citations: result.citations,
        sentToCloud: result.sent_to_cloud,
        cloudSynthesisFields: result.cloud_synthesis_fields,
      })
    } catch (err) {
      replaceLastMessage({
        role: 'assistant',
        type: 'error',
        message: err.message,
        onRetry: () => retry(question),
      })
    } finally {
      setLoading(false)
    }
  }

  function retry(question) {
    replaceLastMessage({ role: 'assistant', type: 'loading' })
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

  useRegisterNewQuestionHandler(useCallback(() => setMessages([]), []))

  return (
    <div className="min-h-full flex flex-col">
      {authExpired && !authBannerDismissed && (
        <div className="shrink-0 flex items-center justify-between gap-4 bg-highlight px-4 lg:px-6 py-3">
          <p className="font-ui text-sm text-ink">
            Your GitHub connection expired — reconnect in{' '}
            <Link to="/settings" className="underline">
              Settings
            </Link>{' '}
            to keep the library up to date.
          </p>
          <button
            type="button"
            onClick={dismissAuthBanner}
            aria-label="Dismiss"
            className="font-ui text-xs text-ink-muted hover:text-ink shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
      <header className="h-14 shrink-0 bg-panel flex items-center justify-between px-4 lg:px-6">
        <RepoFilter repos={repos} selected={selectedRepos} onChange={setSelectedRepos} />
      </header>

      <main className="flex-1 px-4 lg:px-6 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-base text-ink-muted">
              Ask why something in your codebase is the way it is
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {exampleQuestions(repos).map((question) => (
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
            <MessageList
              messages={messages}
              repos={Array.isArray(repos) ? repos : []}
              selectedRepos={selectedRepos}
              disabled={loading}
            />
          </div>
        )}
      </main>

      <div className="shrink-0 bg-panel px-4 lg:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput key={chatKey} initialValue={prefill} onSubmit={handleAsk} disabled={loading} />
        </div>
      </div>
    </div>
  )
}

export default AskPage
