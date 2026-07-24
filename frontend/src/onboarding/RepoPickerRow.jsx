// One row in onboarding step 2's repo list: checkbox + owner/name +
// private badge + a commit-count hint from GitHub's estimate.
function formatCommitEstimate(count) {
  if (count == null) return null
  if (count >= 1000) return `~${(count / 1000).toFixed(1)}k commits`
  return `${count} commit${count === 1 ? '' : 's'}`
}

function RepoPickerRow({ repo, selected, onToggle }) {
  const estimate = formatCommitEstimate(repo.commit_count_estimate)

  return (
    <label className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface cursor-pointer">
      <input type="checkbox" checked={selected} onChange={() => onToggle(repo.name)} />
      <span className="font-mono text-sm text-ink">{repo.name}</span>
      {repo.private && <span className="rounded bg-surface text-ink-muted text-xs px-1.5 py-0.5">Private</span>}
      {estimate && <span className="ml-auto text-sm text-ink-muted">{estimate}</span>}
    </label>
  )
}

export default RepoPickerRow
