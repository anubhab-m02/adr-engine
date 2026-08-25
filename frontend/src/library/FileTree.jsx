// Nested file-tree view built from a flat list of repo paths (e.g.
// `Object.keys()` of the decisions-by-path aggregation). Prerequisite
// shell for the heatmap coloring and click-to-question issues that
// follow — this issue only builds the collapsible tree itself.
import { useState } from 'react'

// A ~40-line recursive build: no tree library needed for splitting `/`
// paths into a nested { dirs, files } shape.
function buildTree(paths) {
  const root = { dirs: new Map(), files: [] }
  for (const path of paths) {
    const segments = path.split('/')
    let node = root
    for (const segment of segments.slice(0, -1)) {
      if (!node.dirs.has(segment)) {
        node.dirs.set(segment, { dirs: new Map(), files: [] })
      }
      node = node.dirs.get(segment)
    }
    node.files.push(segments[segments.length - 1])
  }
  return root
}

function DirNode({ name, node }) {
  const [open, setOpen] = useState(true)

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 text-sm text-ink"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        {name}
      </button>
      {open && <TreeList node={node} indent />}
    </li>
  )
}

function TreeList({ node, indent }) {
  return (
    <ul className={`flex flex-col gap-1 ${indent ? 'pl-4' : ''}`}>
      {[...node.dirs.entries()].map(([name, child]) => (
        <DirNode key={name} name={name} node={child} />
      ))}
      {node.files.map((file) => (
        <li key={file} className="text-sm text-ink-muted">
          {file}
        </li>
      ))}
    </ul>
  )
}

function FileTree({ paths }) {
  const root = buildTree(paths)
  return <TreeList node={root} />
}

export default FileTree
