import { useEffect, useRef } from 'react'
import AnswerCard from './AnswerCard.jsx'
import ErrorCard from './ErrorCard.jsx'
import LoadingCard from './LoadingCard.jsx'

function AssistantMessage({ message, disabled }) {
  if (message.type === 'loading') return <LoadingCard />
  if (message.type === 'error') {
    return <ErrorCard message={message.message} onRetry={message.onRetry} disabled={disabled} />
  }
  // `type` is optional and defaults to 'answer' per its spec — but a
  // genuinely unrecognized value (a typo, a future untyped state) is a
  // bug, not a silent answer with undefined content.
  if (!message.type || message.type === 'answer') {
    return <AnswerCard answer={message.answer} citations={message.citations ?? []} />
  }
  return (
    <ErrorCard
      message={`Unrecognized message type: "${message.type}"`}
      onRetry={() => {}}
      disabled={disabled}
    />
  )
}

function MessageList({ messages, disabled }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message, index) =>
        message.role === 'user' ? (
          <div key={index} className="flex justify-end">
            <div className="max-w-3xl rounded-xl bg-accent text-white p-4">
              {message.content}
            </div>
          </div>
        ) : (
          <div key={index} className="flex justify-start">
            <AssistantMessage message={message} disabled={disabled} />
          </div>
        ),
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default MessageList
