// One row in onboarding step 2's repo list: checkbox + owner/name +
// private-lock icon + a commit-count/time hint from GitHub's estimate.

// Rough ingestion-time heuristic (local extraction + embedding per
// commit) — not a measured figure, tune once real timing data exists.
const SECONDS_PER_COMMIT_ESTIMATE = 0.4

function formatCommitEstimate(count) {
  if (count == null) return null
  const commits = count >= 1000 ? `~${(count / 1000).toFixed(1)}k commits` : `${count} commit${count === 1 ? '' : 's'}`
  const minutes = Math.max(1, Math.round((count * SECONDS_PER_COMMIT_ESTIMATE) / 60))
  return `${commits} · est. ${minutes} min`
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" {...props}>
      <rect x="5" y="9" width="10" height="7" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 016 0V9" strokeLinecap="round" />
    </svg>
  )
}

function RepoPickerRow({ repo, selected, onToggle }) {
  const estimate = formatCommitEstimate(repo.commit_count_estimate)

  return (
    <label className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface cursor-pointer">
      <input type="checkbox" checked={selected} onChange={() => onToggle(repo.name)} />
      <span className="font-mono text-sm text-ink">{repo.name}</span>
      {repo.private && <LockIcon aria-label="Private" className="text-ink-muted shrink-0" />}
      {estimate && <span className="ml-auto text-sm text-ink-muted">{estimate}</span>}
    </label>
  )
}

export default RepoPickerRow
