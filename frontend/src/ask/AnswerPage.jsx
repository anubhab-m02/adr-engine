// The annotated page for one question, replacing the chat-bubble
// rendering of an assistant turn. Per docs/superpowers/specs/2026-08-04-v2-design.md
// Track B: the question is set as a heading carrying a provenance dek
// ("searched N repos · M decisions") stated before the answer is read,
// and from 900px up each paragraph's citations sit in a right margin
// track beside it, rather than collected in a list at the foot of the
// answer. The track narrows from 900-1280px (Tailwind's `min-[900px]:`,
// since the default breakpoints skip straight from 768px to 1024px) and
// widens to its full size at >=1280px (`xl:`). Below 900px there's no
// margin track at all: each paragraph's source cards collapse inline,
// directly after that paragraph, rather than batching every citation in
// one list at the foot of the answer.
import usePrefersReducedMotion from '../lib/usePrefersReducedMotion.js'
import { AnswerParagraph } from './AnswerPassage.jsx'
import { parseAnswer } from './parseAnswer.js'
import SourceCard from './SourceCard.jsx'

function decisionCount(repos, selectedRepos) {
  const selected = new Set(selectedRepos)
  return repos
    .filter((repo) => selected.has(repo.repo))
    .reduce((total, repo) => total + repo.indexed_units, 0)
}

// The units a paragraph cites, in first-appearance order and deduped (a
// repeated marker within one paragraph gets one margin card, not two).
function paragraphUnits(paragraph, citationsById) {
  const seen = new Set()
  const units = []
  for (const part of paragraph.parts) {
    if (part.type !== 'marker' || seen.has(part.unitId)) continue
    seen.add(part.unitId)
    const unit = citationsById.get(part.unitId)
    if (unit) units.push({ unit, number: part.number })
  }
  return units
}

function AnswerPage({ question, answer, citations, repos, selectedRepos }) {
  const repoCount = selectedRepos.length
  const decisions = decisionCount(repos, selectedRepos)
  const reducedMotion = usePrefersReducedMotion()
  const paragraphs = parseAnswer(answer, citations)
  const citationsById = new Map(citations.map((unit) => [unit.id, unit]))

  return (
    <article className="answer-page max-w-3xl min-[900px]:max-w-none">
      <h1 className="font-ui text-2xl text-ink">{question}</h1>
      <p className="font-ui text-sm text-ink-muted mt-1">
        searched {repoCount} repo{repoCount === 1 ? '' : 's'} · {decisions} decision
        {decisions === 1 ? '' : 's'}
      </p>

      <div className="answer-grid mt-6 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,68ch)_180px] min-[900px]:gap-x-8 xl:grid-cols-[minmax(0,68ch)_260px] xl:gap-x-12">
        {paragraphs.map((paragraph) => {
          const units = paragraphUnits(paragraph, citationsById)
          return (
            <div key={paragraph.key} className="min-[900px]:contents">
              <AnswerParagraph
                paragraph={paragraph}
                reducedMotion={reducedMotion}
                className="min-[900px]:col-start-1"
              />
              {units.length > 0 && (
                <div
                  className={`answer-grid-margin hidden min-[900px]:flex min-[900px]:flex-col min-[900px]:justify-center min-[900px]:gap-4 min-[900px]:col-start-2 ${
                    reducedMotion ? '' : 'animate-source-group-entrance'
                  }`}
                >
                  {units.map(({ unit, number }) => (
                    <SourceCard key={unit.id} unit={unit} number={number} widthClassName="w-full" />
                  ))}
                </div>
              )}
              {units.length > 0 && (
                <div
                  className={`answer-grid-inline mt-4 flex flex-wrap gap-4 min-[900px]:hidden ${
                    reducedMotion ? '' : 'animate-source-group-entrance'
                  }`}
                >
                  {units.map(({ unit, number }) => (
                    <SourceCard key={unit.id} unit={unit} number={number} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default AnswerPage
