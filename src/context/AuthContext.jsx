import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Si la sesión ya no es válida (JWT expirado / revocado), limpiar y salir
    if (error) {
      const msg = error.message || ''
      if (
        error.status === 401 ||
        msg.includes('JWT') ||
        msg.includes('invalid') ||
        msg.includes('expired')
      ) {
        await supabase.auth.signOut()
        clearSession()
        return null
      }
    }

    setProfile(data)
    return data
  }

  // Limpia el estado local y fuerza vuelta al login
  function clearSession() {
    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  useEffect(() => {
    // Si la URL tiene el hash de Supabase (magic link / password reset),
    // getSession() lo procesa y establece la sesión. Después limpiamos el hash.
    const hasAuthCallback = window.location.hash.includes('access_token=')

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (hasAuthCallback) {
        window.history.replaceState(null, '', window.location.pathname)
      }
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_EXPIRED') {
          // Token expirado o cierre de sesión: limpiar y dejar que el router
          // redirija a /login via ProtectedRoute
          clearSession()
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          // Token renovado automáticamente: solo actualizar el usuario,
          // no volver a buscar el perfil (ya está en memoria)
          setUser(session?.user ?? null)
          setLoading(false)
          return
        }

        // SIGNED_IN, INITIAL_SESSION, PASSWORD_RECOVERY u otros
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) await fetchProfile(data.user.id)
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id)
    await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signOut, updatePassword, fetchProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => useContext(AuthContext)
