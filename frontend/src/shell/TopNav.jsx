import { NavLink } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/', label: 'Ask' },
  { to: '/library', label: 'Library' },
  { to: '/settings', label: 'Settings' },
]

function linkClassName({ isActive }) {
  return `text-sm px-1 pb-1 border-b-2 ${
    isActive ? 'text-accent border-accent' : 'text-ink-muted border-transparent hover:text-ink'
  }`
}

function TopNav() {
  return (
    <header className="h-14 shrink-0 bg-panel">
      <div className="max-w-5xl mx-auto h-full flex items-center justify-between px-4">
        <span className="text-lg font-semibold">adr-engine</span>
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={linkClassName}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default TopNav
