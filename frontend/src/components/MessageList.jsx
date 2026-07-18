import { useEffect, useRef } from 'react'
import AnswerCard from './AnswerCard.jsx'
import ErrorCard from './ErrorCard.jsx'
import LoadingCard from './LoadingCard.jsx'

function AssistantMessage({ message }) {
  if (message.type === 'loading') return <LoadingCard />
  if (message.type === 'error') {
    return <ErrorCard message={message.message} onRetry={message.onRetry} />
  }
  return <AnswerCard answer={message.answer} citations={message.citations ?? []} />
}

function MessageList({ messages }) {
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
            <AssistantMessage message={message} />
          </div>
        ),
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default MessageList
