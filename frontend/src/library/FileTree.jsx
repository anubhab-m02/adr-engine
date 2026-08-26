// Nested file-tree view built from a flat list of repo paths (e.g.
// `Object.keys()` of the decisions-by-path aggregation), heatmap-colored
// by decision density when a `{path: count}` map is supplied. Prerequisite
// shell for the click-to-question issue that follows.
import { useState } from 'react'

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

function DirNode({ name, node, maxCount }) {
  const [open, setOpen] = useState(true)
  const heat = heatStyle(node.count, maxCount)

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center gap-1 text-sm text-ink rounded px-1 ${heat ? heat.className : ''}`}
        style={heat?.style}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        {name}
      </button>
      {open && <TreeList node={node} maxCount={maxCount} indent />}
    </li>
  )
}

function TreeList({ node, maxCount, indent }) {
  return (
    <ul className={`flex flex-col gap-1 ${indent ? 'pl-4' : ''}`}>
      {[...node.dirs.entries()].map(([name, child]) => (
        <DirNode key={name} name={name} node={child} maxCount={maxCount} />
      ))}
      {node.files.map((file) => {
        const heat = heatStyle(file.count, maxCount)
        return (
          <li
            key={file.path}
            className={`text-sm text-ink-muted rounded px-1 ${heat ? heat.className : ''}`}
            style={heat?.style}
          >
            {file.name}
          </li>
        )
      })}
    </ul>
  )
}

function FileTree({ paths, counts = {} }) {
  const root = buildTree(paths, counts)
  const maxCount = treeMaxCount(root)
  return <TreeList node={root} maxCount={maxCount} />
}

export default FileTree
