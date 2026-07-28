// Onboarding step 2: pick which repos to index. Fetches GET
// /github/repos (debounced on search), lets the user multi-select, and
// submits the choice via PATCH /config — kicking off the actual ingest
// run is IndexStep's job (step 3), not this one.
import { useState } from 'react'
import { patchConfig } from '../api.js'
import RepoPickerRow from './RepoPickerRow.jsx'
import RetryCard from './RetryCard.jsx'
import useRepoPicker from './useRepoPicker.js'

function RepoPickerStep({ onNext }) {
  const { query, setQuery, repos, selected, toggle, retry } = useRepoPicker()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await patchConfig({ indexed_repos: selected })
      onNext(selected)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg text-ink">Which repos should adr-engine read?</h1>
      <p className="text-sm text-ink-muted">
        Extraction runs on your local Ollama — repo contents never leave this machine.
      </p>

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
          <p className="text-sm text-ink-muted">{query ? 'No repos match.' : 'No repos found for this account.'}</p>
        )}

        {Array.isArray(repos) &&
          repos.length > 0 &&
          repos.map((repo) => (
            <RepoPickerRow key={repo.name} repo={repo} selected={selected.includes(repo.name)} onToggle={toggle} />
          ))}
      </div>

      <button
        type="button"
        disabled={selected.length === 0 || submitting}
        onClick={handleSubmit}
        className="mt-4 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
      >
        Index {selected.length} repo{selected.length === 1 ? '' : 's'}
      </button>

      {/* GitHub gives no reliable signal to detect org-restricted access —
          restricted repos are just silently absent from the list, not an
          error. Shown as a standing footnote rather than a fake detected
          state until there's a real way to tell the two cases apart. */}
      <p className="mt-2 text-sm text-ink-muted">
        Missing a repo?{' '}
        <a
          href="https://github.com/settings/connections/applications"
          target="_blank"
          rel="noreferrer"
          className="text-accent"
        >
          Check your organization's access settings
        </a>
        .
      </p>
    </div>
  )
}

export default RepoPickerStep
