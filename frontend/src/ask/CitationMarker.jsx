// Superscript inline citation marker. Its href/id contract
// (`#source-{unitId}` / `source-{unitId}`) is what the SourceCard (next
// issue) will implement — this component only needs to hold up its end
// of it.
function CitationMarker({ number, unitId }) {
  function handleClick(event) {
    event.preventDefault()
    document.getElementById(`source-${unitId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <sup>
      <a
        href={`#source-${unitId}`}
        onClick={handleClick}
        aria-label={`Jump to source ${number}`}
        className="font-ui text-xs text-accent cursor-pointer no-underline hover:underline"
      >
        {number}
      </a>
    </sup>
  )
}

export default CitationMarker
