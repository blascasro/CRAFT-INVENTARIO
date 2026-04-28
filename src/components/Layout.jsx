import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="app-shell">
      <Header onMenuToggle={() => setDrawerOpen(o => !o)} />
      <div className="app-body">
        {drawerOpen && (
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
        )}
        <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
