import { NavLink } from 'react-router-dom'
import StatusPill from './StatusPill.jsx'

// Inline per UI-DESIGN.md's responsive spec (20px, stroke-current, no
// icon font/sprite dependency — matches ARCHITECTURE.md's no-CDN rule).
function QuillIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" {...props}>
      <path d="M4 16l9-9 2 2-9 9H4v-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArchiveBoxIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" {...props}>
      <rect x="3" y="4" width="14" height="3.5" rx="1" />
      <path d="M4 7.5v7a1 1 0 001 1h10a1 1 0 001-1v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11h4" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" {...props}>
      <circle cx="10" cy="10" r="2.75" />
      <path
        d="M10 3.5v1.4M10 15.1v1.4M16.5 10h-1.4M4.9 10H3.5M14.6 5.4l-1 1M6.4 13.6l-1 1M14.6 14.6l-1-1M6.4 6.4l-1-1"
        strokeLinecap="round"
      />
    </svg>
  )
}

const NAV_LINKS = [
  { to: '/', label: 'Ask', Icon: QuillIcon },
  { to: '/library', label: 'Library', Icon: ArchiveBoxIcon },
  { to: '/settings', label: 'Settings', Icon: GearIcon },
]

function linkClassName({ isActive }) {
  return `flex items-center gap-1.5 text-sm px-1 pb-1 border-b-2 ${
    isActive ? 'text-accent border-accent' : 'text-ink-muted border-transparent hover:text-ink'
  }`
}

function TopNav() {
  return (
    <header className="h-14 shrink-0 bg-panel">
      <div className="max-w-5xl mx-auto h-full flex items-center justify-between px-4 lg:px-6">
        <span className="text-lg font-semibold">adr-engine</span>
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClassName} aria-label={label}>
              <Icon />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
          <StatusPill />
        </nav>
      </div>
    </header>
  )
}

export default TopNav
