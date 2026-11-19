// Thin route wrapper for /library/:repo/timeline and /library/:repo/graph —
// decodes the repo path param (repo names contain a slash, so the route
// segment is percent-encoded) and scopes the requested view to it.
import { Link, useParams } from 'react-router-dom'
import useDocumentTitle from '../lib/useDocumentTitle.js'
import DecisionGraph from './DecisionGraph.jsx'
import DecisionTimeline from './DecisionTimeline.jsx'
import RepoFileTree from './RepoFileTree.jsx'

const VIEWS = {
  timeline: { label: 'Timeline', Component: DecisionTimeline },
  graph: { label: 'Graph', Component: DecisionGraph },
  files: { label: 'Files', Component: RepoFileTree },
}

// A hand-edited or truncated URL can contain invalid percent-encoding, which
// makes decodeURIComponent throw; return null so the page can degrade.
function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function RepoDecisionsPage({ view }) {
  const { repo: encodedRepo } = useParams()
  const repo = safeDecode(encodedRepo)
  const { label, Component } = VIEWS[view]
  useDocumentTitle(repo === null ? 'Invalid repo link' : `${repo} · ${label}`)

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
      <Link to="/library" className="text-sm text-ink-muted underline">
        Back to Library
      </Link>
      {repo === null ? (
        <p role="alert" className="text-base text-danger mt-2">
          That repo link is malformed.
        </p>
      ) : (
        <>
          <h1 className="font-reading text-lg text-ink mt-2">
            {repo} · {label}
          </h1>
          <div className="mt-4">
            <Component repo={repo} />
          </div>
        </>
      )}
    </div>
  )
}

export default RepoDecisionsPage
