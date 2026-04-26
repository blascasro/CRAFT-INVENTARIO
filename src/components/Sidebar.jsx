import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const IconEquipment = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
)

const IconSupplies = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)

const IconBags = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
)

const IconParams = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>
  </svg>
)

const navItems = [
  { to: '/equipamiento', label: 'Equipamiento', Icon: IconEquipment },
  { to: '/insumos', label: 'Insumos', Icon: IconSupplies },
  { to: '/morrales', label: 'Morrales', Icon: IconBags },
]

export default function Sidebar() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const linkBase = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    transition: 'all 0.15s',
    marginBottom: 4,
  }

  return (
    <aside
      style={{
        width: 220,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'auto',
      }}
    >
      <nav style={{ flex: 1 }}>
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...linkBase,
              background: isActive ? 'rgba(232,17,45,0.08)' : 'transparent',
              color: isActive ? '#E8112D' : 'var(--text-muted)',
            })}
          >
            <Icon />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div
              style={{
                height: 1,
                background: 'var(--border)',
                margin: '12px 4px',
              }}
            />
            <NavLink
              to="/parametros"
              style={({ isActive }) => ({
                ...linkBase,
                background: isActive ? 'rgba(232,17,45,0.08)' : 'transparent',
                color: isActive ? '#E8112D' : 'var(--text-muted)',
              })}
            >
              <IconParams />
              Parámetros
            </NavLink>
          </>
        )}
      </nav>

      <div
        style={{
          padding: '12px 8px 4px',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>CRAFT v1.0</div>
        <div>Cruz Roja Argentina</div>
        <div>Filial Tandil</div>
      </div>
    </aside>
  )
}
