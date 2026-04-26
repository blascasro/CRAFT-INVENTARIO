import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Equipment from './pages/Equipment'
import Supplies from './pages/Supplies'
import Bags from './pages/Bags'
import Parameters from './pages/Parameters'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen">Verificando sesión</div>
  if (!user) return <Navigate to="/login" replace />
  if (profile?.must_change_password) return <Navigate to="/cambiar-contrasena" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/equipamiento" replace />
  return children
}

export default function App() {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen">Cargando CRAFT</div>

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
        <Route
          path="parametros"
          element={
            <ProtectedRoute adminOnly>
              <Parameters />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
