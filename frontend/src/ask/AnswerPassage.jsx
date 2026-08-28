// The reading room's answer prose: serif body text with inline
// CitationMarkers parsed from `[unit-id]` markers in the raw answer
// string. Numbering follows parse order of first appearance in the
// text itself (per UI-DESIGN.md), not citations' array order.
import usePrefersReducedMotion from '../lib/usePrefersReducedMotion.js'
import CitationMarker from './CitationMarker.jsx'
import { parseAnswer } from './parseAnswer.js'

// Line-height and inter-paragraph spacing for the density preference
// (Track B). 'comfortable' matches the passage's original fixed values.
const DENSITY_CLASSES = {
  comfortable: 'leading-[1.7] mb-6',
  compact: 'leading-[1.4] mb-3',
}

// Renders one already-parsed paragraph. Split out from AnswerPassage so
// AnswerPage's margin-note layout can interleave paragraphs with their
// citations' source cards without duplicating the marker-rendering rules.
export function AnswerParagraph({ paragraph, reducedMotion, density = 'comfortable', className = '' }) {
  return (
    <p
      className={`font-reading text-ink text-[1.0625rem] max-w-[70ch] ${DENSITY_CLASSES[density]} ${
        reducedMotion ? '' : 'animate-answer-settle'
      } ${className}`}
    >
      {paragraph.parts.map((part) =>
        part.type === 'marker' ? (
          <CitationMarker key={part.key} number={part.number} unitId={part.unitId} />
        ) : (
          <span key={part.key}>{part.value}</span>
        ),
      )}
    </p>
  )
}

function AnswerPassage({ answer, citations }) {
  const paragraphs = parseAnswer(answer, citations)
  const reducedMotion = usePrefersReducedMotion()

  return (
    <>
      {paragraphs.map((paragraph) => (
        <AnswerParagraph key={paragraph.key} paragraph={paragraph} reducedMotion={reducedMotion} />
      ))}
    </>
  )
}

export default AnswerPassage
