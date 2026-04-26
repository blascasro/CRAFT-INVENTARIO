import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'

export default function Header() {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header
      style={{
        height: 60,
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxShadow: 'var(--shadow)',
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            background: '#E8112D',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M2 12h20" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            CRAFT
          </span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14, marginLeft: 6 }}>
            — Cruz Roja Tandil
          </span>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 15,
            lineHeight: 1,
            color: 'var(--text)',
            transition: 'background 0.15s',
          }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#E8112D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(profile?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {profile?.email || 'Usuario'}
          </span>
          {profile?.role === 'admin' && (
            <span
              style={{
                padding: '2px 6px',
                background: 'rgba(232,17,45,0.12)',
                color: '#E8112D',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              Admin
            </span>
          )}
        </div>

        <button
          onClick={signOut}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '7px 14px',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-muted)',
            transition: 'background 0.15s, color 0.15s',
            fontFamily: 'var(--font-family)',
          }}
          onMouseEnter={e => { e.target.style.color = '#E8112D'; e.target.style.borderColor = '#E8112D' }}
          onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; e.target.style.borderColor = 'var(--border)' }}
        >
          Salir
        </button>
      </div>
    </header>
  )
}
