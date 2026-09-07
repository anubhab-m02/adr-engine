import { useEffect, useRef } from 'react'
import AnswerPage from '../ask/AnswerPage.jsx'
import SourcesView from '../ask/SourcesView.jsx'
import ErrorCard from './ErrorCard.jsx'
import LoadingCard from './LoadingCard.jsx'

function AssistantMessage({ message, question, repos, selectedRepos, disabled }) {
  if (message.type === 'loading') return <LoadingCard />
  if (message.type === 'error') {
    return <ErrorCard message={message.message} onRetry={message.onRetry} disabled={disabled} />
  }
  // `type` is optional and defaults to 'answer' per its spec — but a
  // genuinely unrecognized value (a typo, a future untyped state) is a
  // bug, not a silent answer with undefined content.
  if (!message.type || message.type === 'answer') {
    const citations = message.citations ?? []
    if (message.mode === 'sources_only') {
      return <SourcesView citations={citations} />
    }
    return (
      <AnswerPage
        question={question}
        answer={message.answer}
        citations={citations}
        repos={repos}
        selectedRepos={selectedRepos}
      />
    )
  }
  return (
    <ErrorCard
      message={`Unrecognized message type: "${message.type}"`}
      onRetry={() => {}}
      disabled={disabled}
    />
  )
}

function MessageList({ messages, repos = [], selectedRepos = [], disabled }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message, index) =>
        message.role === 'user' ? (
          <div key={index} className="flex justify-end">
            <div className="max-w-md rounded-xl bg-highlight text-ink p-3 text-sm">
              {message.content}
            </div>
          </div>
        ) : (
          <div key={index} className="flex justify-start">
            <AssistantMessage
              message={message}
              question={messages[index - 1]?.role === 'user' ? messages[index - 1].content : ''}
              repos={repos}
              selectedRepos={selectedRepos}
              disabled={disabled}
            />
          </div>
        ),
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default MessageList
