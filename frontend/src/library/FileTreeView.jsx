// Thin data-fetching wrapper around FileTree.jsx: turns GET
// /decisions/by-path's `{path: count}` map into the `paths`/`counts`
// props FileTree expects. Shares the fetch/loading/error conventions of
// DecisionTimeline.jsx and DecisionGraph.jsx, its sibling repo-scoped
// views.
import { useEffect, useState } from 'react'
import { getDecisionsByPath } from '../api.js'
import FileTree from './FileTree.jsx'

function FileTreeView({ repo }) {
  const [paths, setPaths] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    setPaths(undefined)
    getDecisionsByPath({ repo })
      .then((result) => {
        if (!cancelled) setPaths(result.paths)
      })
      .catch(() => {
        if (!cancelled) setPaths('error')
      })
    return () => {
      cancelled = true
    }
  }, [repo])

  if (paths === undefined) {
    return <p className="text-sm text-ink-muted">Loading files…</p>
  }
  if (paths === 'error') {
    return <p className="text-sm text-danger">Couldn't load the file tree.</p>
  }
  if (Object.keys(paths).length === 0) {
    return <p className="font-reading text-ink">No decisions indexed yet.</p>
  }

  return <FileTree paths={Object.keys(paths)} counts={paths} />
}

export default FileTreeView
