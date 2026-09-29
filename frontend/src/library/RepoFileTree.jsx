// Fetches a repo's {path: count} map from GET /decisions/by-path and feeds
// it to FileTree, which navigates to Ask with a pre-filled question on click.
import { useEffect, useState } from 'react'
import { getDecisionsByPath } from '../api.js'
import FileTree from './FileTree.jsx'

function RepoFileTree({ repo }) {
  const [counts, setCounts] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    setCounts(undefined)
    getDecisionsByPath({ repo })
      .then((result) => {
        if (!cancelled) setCounts(result.paths)
      })
      .catch(() => {
        if (!cancelled) setCounts('error')
      })
    return () => {
      cancelled = true
    }
  }, [repo])

  if (counts === undefined) return <p className="text-sm text-ink-muted">Loading files…</p>
  if (counts === 'error') return <p className="text-sm text-danger">Couldn't load the file tree.</p>
  if (Object.keys(counts).length === 0) {
    return <p className="font-reading text-ink">No decisions indexed yet.</p>
  }
  return <FileTree paths={Object.keys(counts)} counts={counts} />
}

export default RepoFileTree
