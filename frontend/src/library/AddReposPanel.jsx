// Library's "Add repos" panel (UI-DESIGN.md: "reuses RepoPickerStep
// internals"). Shares useRepoPicker/RepoPickerRow/RetryCard with
// onboarding's RepoPickerStep but differs in what submitting does:
// PATCH /config with the *expanded* repo list, then POST /ingest with
// only the newly added repos (already-indexed repos aren't re-ingested).
import { useState } from 'react'
import { patchConfig, postIngest } from '../api.js'
import RepoPickerRow from '../onboarding/RepoPickerRow.jsx'
import RetryCard from '../onboarding/RetryCard.jsx'
import useRepoPicker from '../onboarding/useRepoPicker.js'

function AddReposPanel({ indexedRepos, onDone, onCancel }) {
  const { query, setQuery, repos, selected, toggle, retry } = useRepoPicker({ excludeRepos: indexedRepos })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await patchConfig({ indexed_repos: [...indexedRepos, ...selected] })
      await postIngest({ repos: selected })
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-panel p-4">
      <h2 className="text-lg text-ink">Add repos</h2>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search repos"
        aria-label="Search repos"
        className="mt-4 w-full rounded-lg border border-transparent bg-surface px-3 py-2 text-sm text-ink"
      />

      <div className="mt-2">
        {repos === undefined &&
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="mb-1.5 h-9 animate-pulse rounded-lg bg-surface" />
          ))}

        {repos === 'error' && (
          <RetryCard
            message="Couldn't load your repos."
            messageTone="danger"
            bordered
            buttonTone="danger"
            onRetry={retry}
          />
        )}

        {Array.isArray(repos) && repos.length === 0 && (
          <p className="text-sm text-ink-muted">{query ? 'No repos match.' : 'No new repos to add.'}</p>
        )}

        {Array.isArray(repos) &&
          repos.length > 0 &&
          repos.map((repo) => (
            <RepoPickerRow key={repo.name} repo={repo} selected={selected.includes(repo.name)} onToggle={toggle} />
          ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={selected.length === 0 || submitting}
          onClick={handleSubmit}
          className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
        >
          Index {selected.length} repo{selected.length === 1 ? '' : 's'}
        </button>

        <button type="button" onClick={onCancel} className="text-sm text-ink-muted">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default AddReposPanel
