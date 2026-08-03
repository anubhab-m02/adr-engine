import RepoPickerRow from './RepoPickerRow.jsx'
import RetryCard from './RetryCard.jsx'

// Shared search-results shape behind RepoPickerStep (onboarding) and
// AddReposPanel (Library) — loading skeleton, error retry, empty state,
// and the row list itself. Only the empty-state copy and what submitting
// does with `selected` differ between callers.
function RepoPickerList({ query, repos, selected, onToggle, onRetry, emptyMessage }) {
  return (
    <div className="mt-2">
      {repos === undefined &&
        Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="mb-1.5 h-9 animate-pulse rounded-lg bg-highlight" />
        ))}

      {repos === 'error' && (
        <RetryCard
          message="Couldn't load your repos."
          messageTone="danger"
          bordered
          buttonTone="danger"
          onRetry={onRetry}
        />
      )}

      {Array.isArray(repos) && repos.length === 0 && (
        <p className="text-sm text-ink-muted">{query ? 'No repos match.' : emptyMessage}</p>
      )}

      {Array.isArray(repos) &&
        repos.length > 0 &&
        repos.map((repo) => (
          <RepoPickerRow key={repo.name} repo={repo} selected={selected.includes(repo.name)} onToggle={onToggle} />
        ))}
    </div>
  )
}

export default RepoPickerList
