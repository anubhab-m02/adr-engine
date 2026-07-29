// UI-DESIGN.md's Library page: one RepoRow per configured repo, with live
// indexed-unit counts from GET /repos, plus Add repos (opens
// AddReposPanel) and per-row Remove (#80).
import { useEffect, useState } from 'react'
import { getRepos, patchConfig } from '../api.js'
import AddReposPanel from './AddReposPanel.jsx'
import RepoRow from './RepoRow.jsx'

function LibraryPage() {
  const [repos, setRepos] = useState(undefined)
  const [showAddPanel, setShowAddPanel] = useState(false)

  function fetchRepos(onSettled) {
    getRepos()
      .then((result) => onSettled(result.repos))
      .catch(() => onSettled('error'))
  }

  useEffect(() => {
    let cancelled = false
    fetchRepos((result) => {
      if (!cancelled) setRepos(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function refresh() {
    fetchRepos(setRepos)
  }

  async function handleRemove(repoName) {
    const remaining = repos.filter((repo) => repo.repo !== repoName)
    await patchConfig({ indexed_repos: remaining.map((repo) => repo.repo) })
    setRepos(remaining)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-reading text-lg text-ink">Library</h1>
        <button
          type="button"
          onClick={() => setShowAddPanel(true)}
          className="rounded-lg bg-accent text-accent-ink text-sm font-semibold px-4 py-2"
        >
          Add repos
        </button>
      </div>

      {showAddPanel && (
        <AddReposPanel
          indexedRepos={Array.isArray(repos) ? repos.map((repo) => repo.repo) : []}
          onDone={() => {
            setShowAddPanel(false)
            refresh()
          }}
          onCancel={() => setShowAddPanel(false)}
        />
      )}

      {repos === 'error' && (
        <p className="mt-4 text-sm text-danger">Couldn't load the library.</p>
      )}
      {Array.isArray(repos) && repos.length === 0 && (
        <p className="mt-4 font-reading text-ink">Nothing in the library yet.</p>
      )}
      {Array.isArray(repos) && repos.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {repos.map((repo) => (
            <RepoRow key={repo.repo} repo={repo} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  )
}

export default LibraryPage
