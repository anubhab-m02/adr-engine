// Shared repo-fetch/select logic behind RepoPickerStep (onboarding) and
// AddReposPanel (Library, #80) — search + debounced GET /github/repos +
// multi-select, with no opinion on what submitting does with the
// selection (that's caller-specific: PATCH+onNext vs PATCH+POST /ingest).
import { useEffect, useState } from 'react'
import { getGithubRepos } from '../api.js'

const SEARCH_DEBOUNCE_MS = 300

function useRepoPicker({ excludeRepos = [] } = {}) {
  const [query, setQuery] = useState('')
  const [repos, setRepos] = useState(undefined)
  const [selected, setSelected] = useState([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    function fetchRepos() {
      getGithubRepos(query ? { query } : {})
        .then((result) => {
          if (!cancelled) setRepos(result.repos.filter((repo) => !excludeRepos.includes(repo.name)))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, attempt])

  function toggle(name) {
    setSelected((current) => (current.includes(name) ? current.filter((r) => r !== name) : [...current, name]))
  }

  function retry() {
    setAttempt((a) => a + 1)
  }

  return { query, setQuery, repos, selected, toggle, retry }
}

export default useRepoPicker
