// Nested file-tree view built from a flat list of repo paths (e.g.
// `Object.keys()` of the decisions-by-path aggregation), heatmap-colored
// by decision density when a `{path: count}` map is supplied.
//
// Two separate click targets per directory row, per the click-to-question
// product decision (ROADMAP.md): the caret expands/collapses, the name
// text scopes a question to that path. Backend path filtering is deferred
// to its own issue — this only pre-fills the question text.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function questionForPath(path) {
  return `Why is \`${path}\` the way it is?`
}

// A ~40-line recursive build: no tree library needed for splitting `/`
// paths into a nested { dirs, files } shape. Each node carries its own
// full path (for counts lookup/click-to-question) and a `count` that's
// the sum of its descendant files' counts, so a directory heats up when
// any file beneath it does.
function buildTree(paths, counts) {
  const root = { dirs: new Map(), files: [], path: '', count: 0 }
  for (const path of paths) {
    const fileCount = counts[path] ?? 0
    const segments = path.split('/')
    let node = root
    node.count += fileCount
    let prefix = ''
    for (const segment of segments.slice(0, -1)) {
      prefix = prefix ? `${prefix}/${segment}` : segment
      if (!node.dirs.has(segment)) {
        node.dirs.set(segment, { dirs: new Map(), files: [], path: prefix, count: 0 })
      }
      node = node.dirs.get(segment)
      node.count += fileCount
    }
    node.files.push({ name: segments[segments.length - 1], path, count: fileCount })
  }
  return root
}

function treeMaxCount(node) {
  let max = node.count
  for (const child of node.dirs.values()) {
    max = Math.max(max, treeMaxCount(child))
  }
  for (const file of node.files) {
    max = Math.max(max, file.count)
  }
  return max
}

// Intensity is normalized against the whole tree's own max count (not a
// fixed scale) so the heatmap uses its full visual range regardless of
// repo size, and expressed as a `--heat-intensity` custom property rather
// than a literal `color-mix()` inline value — jsdom's style parser
// accepts arbitrary custom-property strings but not modern color
// functions, and this keeps the `color-mix`/`--color-accent` mixing in
// one CSS rule (`.heat` in index.css) instead of duplicated per node.
function heatStyle(count, maxCount) {
  if (!count || !maxCount) return null
  const intensity = Math.round((count / maxCount) * 80) + 15
  return { className: 'heat', style: { '--heat-intensity': `${intensity}%` } }
}

function DirNode({ name, node, maxCount, onSelect }) {
  const [open, setOpen] = useState(true)
  const heat = heatStyle(node.count, maxCount)

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
          onClick={() => setOpen((current) => !current)}
          className="text-sm text-ink rounded px-1"
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          className={`text-sm text-ink rounded px-1 ${heat ? heat.className : ''}`}
          style={heat?.style}
        >
          {name}
        </button>
      </div>
      {open && <TreeList node={node} maxCount={maxCount} indent onSelect={onSelect} />}
    </li>
  )
}

function TreeList({ node, maxCount, indent, onSelect }) {
  return (
    <ul className={`flex flex-col gap-1 ${indent ? 'pl-4' : ''}`}>
      {[...node.dirs.entries()].map(([name, child]) => (
        <DirNode key={name} name={name} node={child} maxCount={maxCount} onSelect={onSelect} />
      ))}
      {node.files.map((file) => {
        const heat = heatStyle(file.count, maxCount)
        return (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => onSelect(file.path)}
              className={`text-sm text-ink-muted rounded px-1 ${heat ? heat.className : ''}`}
              style={heat?.style}
            >
              {file.name}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function FileTree({ paths, counts = {} }) {
  const navigate = useNavigate()
  const root = buildTree(paths, counts)
  const maxCount = treeMaxCount(root)

  function handleSelect(path) {
    navigate('/', { state: { prefillQuestion: questionForPath(path) } })
  }

  return <TreeList node={root} maxCount={maxCount} onSelect={handleSelect} />
}

export default FileTree
