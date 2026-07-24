import { Outlet } from 'react-router-dom'
import TopNav from './TopNav.jsx'

function AppShell() {
  return (
    <div className="min-h-svh bg-surface text-ink flex flex-col">
      <TopNav />
      <div className="flex-1 max-w-5xl mx-auto w-full">
        <Outlet />
      </div>
    </div>
  )
}

export default AppShell
