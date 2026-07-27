// The reading room's answer prose: serif body text with inline
// CitationMarkers parsed from `[unit-id]` markers in the raw answer
// string. Numbering follows parse order of first appearance in the
// text itself (per UI-DESIGN.md), not citations' array order.
import usePrefersReducedMotion from '../lib/usePrefersReducedMotion.js'
import CitationMarker from './CitationMarker.jsx'

const CITATION_PATTERN = /\[([^[\]]+)\]/g

function parseAnswer(answer, citations) {
  const knownIds = new Set(citations.map((unit) => unit.id))
  const numberById = new Map()
  const parts = []
  let lastIndex = 0
  let match

  CITATION_PATTERN.lastIndex = 0
  while ((match = CITATION_PATTERN.exec(answer)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', key: parts.length, value: answer.slice(lastIndex, match.index) })
    }

    const unitId = match[1]
    if (!knownIds.has(unitId)) {
      parts.push({ type: 'text', key: parts.length, value: match[0] })
    } else {
      if (!numberById.has(unitId)) numberById.set(unitId, numberById.size + 1)
      parts.push({ type: 'marker', key: parts.length, number: numberById.get(unitId), unitId })
    }

    lastIndex = CITATION_PATTERN.lastIndex
  }

  if (lastIndex < answer.length) {
    parts.push({ type: 'text', key: parts.length, value: answer.slice(lastIndex) })
  }

  return parts
}

function AnswerPassage({ answer, citations }) {
  const parts = parseAnswer(answer, citations)
  const reducedMotion = usePrefersReducedMotion()

  return (
    <p
      className={`font-reading text-ink text-[1.0625rem] leading-[1.7] max-w-[70ch] ${
        reducedMotion ? '' : 'animate-answer-settle'
      }`}
    >
      {parts.map((part) =>
        part.type === 'marker' ? (
          <CitationMarker key={part.key} number={part.number} unitId={part.unitId} />
        ) : (
          <span key={part.key}>{part.value}</span>
        ),
      )}
    </p>
  )
}

export default AnswerPassage
