import { useEffect, useRef, useState } from 'react'

function RepoFilter({ repos, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef(null)

  const loading = repos == null || repos.length === 0

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading repos"
        className="h-9 w-28 rounded-lg bg-panel animate-pulse"
      />
    )
  }

  if (repos.length === 1) {
    return (
      <span className="inline-block rounded-lg bg-panel text-ink text-sm px-3 py-1.5">
        {repos[0].repo}
      </span>
    )
  }

  const label =
    selected.length === repos.length
      ? 'All repos'
      : `${selected.length} repo${selected.length === 1 ? '' : 's'}`

  function toggle(repo) {
    onChange(
      selected.includes(repo)
        ? selected.filter((r) => r !== repo)
        : [...selected, repo],
    )
  }

  function handleKeyDown(event) {
    if (!open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, repos.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === ' ') {
      event.preventDefault()
      toggle(repos[activeIndex].repo)
    }
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg bg-panel text-ink text-sm px-3 py-1.5"
      >
        {label}
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute right-0 z-10 mt-2 w-56 rounded-xl bg-panel p-2 shadow"
        >
          {repos.map((r, index) => (
            <li
              key={r.repo}
              role="option"
              aria-selected={selected.includes(r.repo)}
              tabIndex={-1}
              onClick={() => toggle(r.repo)}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${
                index === activeIndex ? 'bg-surface' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(r.repo)}
                readOnly
                className="pointer-events-none"
              />
              <span className="text-ink">{r.repo}</span>
              <span className="ml-auto text-ink-muted">{r.indexed_units}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default RepoFilter
