// Onboarding step 2: pick which repos to index. Fetches GET
// /github/repos (debounced on search), lets the user multi-select, and
// submits the choice via PATCH /config — kicking off the actual ingest
// run is IndexStep's job (step 3), not this one.
import { useEffect, useState } from 'react'
import { getGithubRepos, patchConfig } from '../api.js'
import RepoPickerRow from './RepoPickerRow.jsx'

const SEARCH_DEBOUNCE_MS = 300

function RepoPickerStep({ onNext }) {
  const [query, setQuery] = useState('')
  const [repos, setRepos] = useState(undefined)
  const [selected, setSelected] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    function fetchRepos() {
      getGithubRepos(query ? { query } : {})
        .then((result) => {
          if (!cancelled) setRepos(result.repos)
        })
        .catch(() => {
          if (!cancelled) setRepos('error')
        })
    }

    setRepos(undefined)
    const timer = setTimeout(fetchRepos, query ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, attempt])

  function toggle(name) {
    setSelected((current) => (current.includes(name) ? current.filter((r) => r !== name) : [...current, name]))
  }

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
          <div className="rounded-xl border border-danger p-4">
            <p className="text-sm text-danger">Couldn't load your repos.</p>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-2 rounded-lg bg-danger text-white text-sm font-semibold px-4 py-2"
            >
              Retry
            </button>
          </div>
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
    </div>
  )
}

export default RepoPickerStep
