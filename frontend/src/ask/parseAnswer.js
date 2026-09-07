// Parses an answer string into paragraphs of text/marker parts. Shared by
// AnswerPassage (flat rendering) and AnswerPage (margin-note layout, which
// needs to know per paragraph which citations it references).
const CITATION_PATTERN = /\[([^[\]]+)\]/g

// Splits into paragraphs first, then parses citation markers within each
// one, so each paragraph's parts are addressable on their own (a margin
// note needs to know "paragraph 2 cites marker 3" to sit beside paragraph
// 2). Marker numbering still runs off one shared map, so it follows
// first-appearance order across the whole answer, not reset per paragraph.
function parseParagraph(paragraph, knownIds, numberById, paragraphIndex) {
  const parts = []
  let lastIndex = 0
  let match

  CITATION_PATTERN.lastIndex = 0
  while ((match = CITATION_PATTERN.exec(paragraph)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        key: parts.length,
        value: paragraph.slice(lastIndex, match.index),
      })
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

  if (lastIndex < paragraph.length) {
    parts.push({ type: 'text', key: parts.length, value: paragraph.slice(lastIndex) })
  }

  return { key: paragraphIndex, parts }
}

export function parseAnswer(answer, citations) {
  const knownIds = new Set(citations.map((unit) => unit.id))
  const numberById = new Map()

  return answer
    .split('\n\n')
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph, index) => parseParagraph(paragraph, knownIds, numberById, index))
}
