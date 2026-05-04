import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Equipment from './pages/Equipment'
import Supplies from './pages/Supplies'
import Bags from './pages/Bags'
import Parameters from './pages/Parameters'
import Auditoria from './pages/Auditoria'
import Indumentaria from './pages/Indumentaria'
import Calculadora from './pages/Calculadora'

// Pantalla de carga con botón "Reintentar" si tarda más de 8 segundos
function LoadingScreen({ message }) {
  const [showRetry, setShowRetry] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShowRetry(true), 8000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="loading-screen">
      <span>{message}</span>
      {showRetry && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            La carga está tardando más de lo esperado.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
            }}
          >
            ↺ Reintentar conexión
          </button>
        </div>
      )}
    </div>
  )
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingScreen message="Verificando sesión" />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.must_change_password) return <Navigate to="/cambiar-contrasena" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/equipamiento" replace />
  return children
}

export default function App() {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingScreen message="Cargando CRAFT" />

  return (
    <Routes>
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/equipamiento" replace />}
      />
      <Route
        path="/cambiar-contrasena"
        element={user ? <ChangePassword /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/equipamiento" replace />} />
        <Route path="equipamiento" element={<Equipment />} />
        <Route path="insumos" element={<Supplies />} />
        <Route path="morrales" element={<Bags />} />
        <Route path="indumentaria" element={<Indumentaria />} />
        <Route path="calculadora" element={<Calculadora />} />
        <Route
          path="parametros"
          element={
            <ProtectedRoute adminOnly>
              <Parameters />
            </ProtectedRoute>
          }
        />
        <Route
          path="auditoria"
          element={
            <ProtectedRoute adminOnly>
              <Auditoria />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
