import { MESSAGE_CARD_BASE } from './messageCardBase.js'

// Per ROADMAP.md's Product decisions (resolved 2026-09-22): `/query`
// stays a single synchronous call, so this is one honest status for the
// whole in-flight request rather than fake-cycling through invented
// stages a client can't actually observe.
const STATUS = 'Searching decision history…'

function LoadingCard() {
  return (
    <div role="status" className={MESSAGE_CARD_BASE}>
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-ink-muted animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-ink-muted animate-pulse [animation-delay:150ms]" />
        <span className="h-2 w-2 rounded-full bg-ink-muted animate-pulse [animation-delay:300ms]" />
      </div>
      <p className="text-sm text-ink-muted mt-2">{STATUS}</p>
    </div>
  )
}

export default LoadingCard
