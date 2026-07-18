import { useEffect, useState } from 'react'

const STATUSES = [
  'Searching decision history…',
  'Reading citations…',
  'Synthesizing an answer…',
]

function LoadingCard() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % STATUSES.length)
    }, 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <div role="status" className="max-w-3xl rounded-xl bg-panel p-4">
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-ink-muted animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-ink-muted animate-pulse [animation-delay:150ms]" />
        <span className="h-2 w-2 rounded-full bg-ink-muted animate-pulse [animation-delay:300ms]" />
      </div>
      <p className="text-sm text-ink-muted mt-2">{STATUSES[index]}</p>
    </div>
  )
}

export default LoadingCard
