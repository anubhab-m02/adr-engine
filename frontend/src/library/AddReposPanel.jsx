// Library's "Add repos" panel (UI-DESIGN.md: "reuses RepoPickerStep
// internals"). Shares useRepoPicker/RepoPickerRow/RetryCard with
// onboarding's RepoPickerStep but differs in what submitting does:
// PATCH /config with the *expanded* repo list, then POST /ingest with
// only the newly added repos (already-indexed repos aren't re-ingested).
import { useState } from 'react'
import { patchConfig, postIngest } from '../api.js'
import RepoPickerList from '../onboarding/RepoPickerList.jsx'
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

      <RepoPickerList
        query={query}
        repos={repos}
        selected={selected}
        onToggle={toggle}
        onRetry={retry}
        emptyMessage="No new repos to add."
      />

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={selected.length === 0 || submitting}
          onClick={handleSubmit}
          className="rounded-lg bg-accent text-accent-ink text-sm font-semibold px-4 py-2 disabled:opacity-50"
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
