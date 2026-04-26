import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    return data
  }

  useEffect(() => {
    // Si la URL todavía tiene el hash de Supabase (access_token), getSession()
    // lo procesa automáticamente y establece la sesión. Después limpiamos el hash
    // para que no quede visible en la barra de direcciones.
    const hasAuthCallback = window.location.hash.includes('access_token=')

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (hasAuthCallback) {
        // Limpiar el hash de la URL una vez que Supabase procesó el token
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
