import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

/**
 * Envuelve cualquier Promise (o thenable de Supabase) con un timeout.
 * Si la operación no responde en `ms` milisegundos, rechaza con un error claro.
 * El clearTimeout evita memory leaks cuando la operación resuelve antes.
 */
export function withTimeout(promise, ms = 10000) {
  let timerId
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error('Tiempo de espera agotado. Verificá tu conexión.')),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId))
}
