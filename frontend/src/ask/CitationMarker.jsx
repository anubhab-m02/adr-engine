// Superscript inline citation marker. Its href/id contract
// (`#source-{unitId}` / `source-{unitId}`) is what the SourceCard
// implements — this component only needs to hold up its end of it, which
// is also how it reaches a note it doesn't render itself (margin column
// or inline collapse, depending on viewport): by looking it up via that
// shared id rather than through shared React state.
//
// Ink-in stagger: per UI-DESIGN.md's Ask "Signature moment", markers ink
// in 60ms apart starting 180ms after the passage settles (--dur-surface).
// `number` is 1-indexed parse order, so marker 1 gets no extra stagger.
import { useRef } from 'react'
import usePrefersReducedMotion from '../lib/usePrefersReducedMotion.js'

const WASH_DURATION_MS = 1200

// SourceCard's default (`bg-panel`) and highlighted (`bg-highlight`) fills
// both set `background-color`, so both classes must never be present at
// once — whichever is later in the compiled stylesheet would silently win.
function setHighlighted(source, highlighted) {
  source.classList.toggle('bg-highlight', highlighted)
  source.classList.toggle('bg-panel', !highlighted)
}

function CitationMarker({ number, unitId }) {
  const reducedMotion = usePrefersReducedMotion()
  const washTimeoutRef = useRef(null)

  function clearWashTimeout() {
    if (washTimeoutRef.current == null) return
    clearTimeout(washTimeoutRef.current)
    washTimeoutRef.current = null
  }

  function highlight() {
    clearWashTimeout()
    const source = document.getElementById(`source-${unitId}`)
    if (source) setHighlighted(source, true)
  }

  function unhighlight() {
    const source = document.getElementById(`source-${unitId}`)
    if (source) setHighlighted(source, false)
  }

  function handleClick(event) {
    event.preventDefault()
    const source = document.getElementById(`source-${unitId}`)
    source?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    if (!source || reducedMotion) return
    setHighlighted(source, true)
    clearWashTimeout()
    washTimeoutRef.current = setTimeout(() => {
      setHighlighted(source, false)
      washTimeoutRef.current = null
    }, WASH_DURATION_MS)
  }

  const style = reducedMotion
    ? undefined
    : { animationDelay: `calc(var(--dur-surface) + ${180 + (number - 1) * 60}ms)` }

  return (
    <sup>
      <a
        href={`#source-${unitId}`}
        onClick={handleClick}
        onMouseEnter={highlight}
        onMouseLeave={unhighlight}
        onFocus={highlight}
        onBlur={unhighlight}
        aria-label={`Jump to source ${number}`}
        style={style}
        className={`font-ui text-xs text-accent cursor-pointer no-underline hover:underline ${
          reducedMotion ? '' : 'animate-citation-ink-in'
        }`}
      >
        {number}
      </a>
    </sup>
  )
}

export default CitationMarker
