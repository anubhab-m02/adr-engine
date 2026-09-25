// Thin route wrapper for /library/:repo/timeline, /library/:repo/graph,
// and /library/:repo/files — decodes the repo path param (repo names
// contain a slash, so the route segment is percent-encoded) and scopes
// the requested view to it.
import { Link, useParams } from 'react-router-dom'
import DecisionGraph from './DecisionGraph.jsx'
import DecisionTimeline from './DecisionTimeline.jsx'
import FileTreeView from './FileTreeView.jsx'

const VIEWS = {
  timeline: { label: 'Timeline', Component: DecisionTimeline },
  graph: { label: 'Graph', Component: DecisionGraph },
  files: { label: 'Files', Component: FileTreeView },
}

function RepoDecisionsPage({ view }) {
  const { repo: encodedRepo } = useParams()
  const repo = decodeURIComponent(encodedRepo)
  const { label, Component } = VIEWS[view]

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
      <Link to="/library" className="text-sm text-ink-muted underline">
        Back to Library
      </Link>
      <h1 className="font-reading text-lg text-ink mt-2">
        {repo} · {label}
      </h1>
      <div className="mt-4">
        <Component repo={repo} />
      </div>
    </div>
  )
}

export default RepoDecisionsPage
