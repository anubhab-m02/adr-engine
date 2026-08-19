// The annotated page for one question, replacing the chat-bubble
// rendering of an assistant turn. Per docs/superpowers/specs/2026-08-04-v2-design.md
// Track B: the question is set as a heading carrying a provenance dek
// ("searched N repos · M decisions") stated before the answer is read.
import AnswerPassage from './AnswerPassage.jsx'
import SourceCardList from './SourceCardList.jsx'

function decisionCount(repos, selectedRepos) {
  const selected = new Set(selectedRepos)
  return repos
    .filter((repo) => selected.has(repo.repo))
    .reduce((total, repo) => total + repo.indexed_units, 0)
}

function AnswerPage({ question, answer, citations, repos, selectedRepos }) {
  const repoCount = selectedRepos.length
  const decisions = decisionCount(repos, selectedRepos)

  return (
    <article className="max-w-3xl">
      <h1 className="font-ui text-2xl text-ink">{question}</h1>
      <p className="font-ui text-sm text-ink-muted mt-1">
        searched {repoCount} repo{repoCount === 1 ? '' : 's'} · {decisions} decision
        {decisions === 1 ? '' : 's'}
      </p>

      <div className="mt-6">
        <AnswerPassage answer={answer} citations={citations} />
      </div>

      {citations.length > 0 && (
        <SourceCardList citations={citations} className="mt-4 flex flex-wrap gap-4" />
      )}
    </article>
  )
}

export default AnswerPage
