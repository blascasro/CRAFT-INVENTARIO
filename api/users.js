const { createClient } = require('@supabase/supabase-js')

async function getAdminClients(token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return { supabaseUser, supabaseAdmin }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  let supabaseUser, supabaseAdmin
  try {
    ;({ supabaseUser, supabaseAdmin } = await getAdminClients(token))
  } catch {
    return res.status(500).json({ error: 'Error de configuración' })
  }

  // Verify caller is admin
  try {
    const { data: { user }, error } = await supabaseUser.auth.getUser()
    if (error || !user) return res.status(401).json({ error: 'Token inválido' })

    const { data: profile } = await supabaseUser.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' })
  } catch {
    return res.status(401).json({ error: 'Error de autenticación' })
  }

  // ── GET /api/users ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
      if (error) return res.status(500).json({ error: error.message })

      const { data: profiles } = await supabaseAdmin.from('profiles').select('*')
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

      const result = users.map(u => ({
        id: u.id,
        email: u.email,
        banned_until: u.banned_until,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        profile: profileMap[u.id] || null,
      }))

      return res.status(200).json(result)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── POST /api/users ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { email, password, username, role } = req.body || {}
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'email, password y username son requeridos' })
    }

    try {
      const { data: { user: newUser }, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createErr) return res.status(400).json({ error: createErr.message })

      const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
        id: newUser.id,
        username: username.trim(),
        role: role === 'admin' ? 'admin' : 'volunteer',
        must_change_password: true,
      })
      if (profileErr) return res.status(400).json({ error: profileErr.message })

      return res.status(201).json({ id: newUser.id, email: newUser.email })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── PATCH /api/users ──────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { userId, role } = req.body || {}
    if (!userId || !role) return res.status(400).json({ error: 'userId y role son requeridos' })
    if (!['admin', 'volunteer'].includes(role)) return res.status(400).json({ error: 'Rol inválido' })

    try {
      const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', userId)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── DELETE /api/users ─────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId es requerido' })

    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '87600h',
      })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
