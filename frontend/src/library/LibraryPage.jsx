// UI-DESIGN.md's Library page: one RepoRow per configured repo, with live
// indexed-unit counts from GET /repos. Add/remove repo actions are a
// separate, later issue.
import { useEffect, useState } from 'react'
import { getRepos } from '../api.js'
import RepoRow from './RepoRow.jsx'

function LibraryPage() {
  const [repos, setRepos] = useState(undefined)

  useEffect(() => {
    let cancelled = false

    getRepos()
      .then((result) => {
        if (!cancelled) setRepos(result.repos)
      })
      .catch(() => {
        if (!cancelled) setRepos('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-reading text-lg text-ink">Library</h1>

      {repos === 'error' && (
        <p className="mt-4 text-sm text-danger">Couldn't load the library.</p>
      )}
      {Array.isArray(repos) && repos.length === 0 && (
        <p className="mt-4 font-reading text-ink">Nothing in the library yet.</p>
      )}
      {Array.isArray(repos) && repos.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {repos.map((repo) => (
            <RepoRow key={repo.repo} repo={repo} />
          ))}
        </div>
      )}
    </div>
  )
}

export default LibraryPage
