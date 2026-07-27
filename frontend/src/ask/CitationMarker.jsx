// Superscript inline citation marker. Its href/id contract
// (`#source-{unitId}` / `source-{unitId}`) is what the SourceCard (next
// issue) will implement — this component only needs to hold up its end
// of it.
//
// Ink-in stagger: per UI-DESIGN.md's Ask "Signature moment", markers ink
// in 60ms apart starting 180ms after the passage settles (--dur-surface).
// `number` is 1-indexed parse order, so marker 1 gets no extra stagger.
import usePrefersReducedMotion from '../lib/usePrefersReducedMotion.js'

function CitationMarker({ number, unitId }) {
  const reducedMotion = usePrefersReducedMotion()

  function handleClick(event) {
    event.preventDefault()
    document.getElementById(`source-${unitId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const style = reducedMotion
    ? undefined
    : { animationDelay: `calc(var(--dur-surface) + ${180 + (number - 1) * 60}ms)` }

  return (
    <sup>
      <a
        href={`#source-${unitId}`}
        onClick={handleClick}
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
