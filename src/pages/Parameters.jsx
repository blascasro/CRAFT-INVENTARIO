import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const TABS = ['Insumos', 'Morrales', 'Equipamiento', 'Usuarios']

// ── Supplies tab ─────────────────────────────────────────────────────────────
function SuppliesTab() {
  const [supplies, setSupplies] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    supabase.from('supplies').select('*').order('name').then(({ data }) => setSupplies(data || []))
  }, [])

  async function saveIdeal(id) {
    const val = parseInt(editValue, 10)
    if (isNaN(val) || val < 0) { setEditingId(null); return }
    await supabase.from('supplies').update({ ideal_stock: val }).eq('id', id)
    setSupplies(prev => prev.map(s => s.id === id ? { ...s, ideal_stock: val } : s))
    setEditingId(null)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Modificar el stock ideal de cada insumo. El stock actual se edita desde la sección Insumos.
      </p>
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th style={{ textAlign: 'right' }}>Stock ideal</th>
              <th style={{ textAlign: 'right' }}>Stock actual</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {supplies.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td style={{ textAlign: 'right' }}>
                  {editingId === s.id ? (
                    <input
                      type="number"
                      min="0"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      autoFocus
                      style={{
                        width: 80,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        fontSize: 13,
                        textAlign: 'right',
                        outline: 'none',
                        fontFamily: 'var(--font-family)',
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveIdeal(s.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => saveIdeal(s.id)}
                    />
                  ) : (
                    <span style={{ fontWeight: 600 }}>{s.ideal_stock}</span>
                  )}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{s.current_stock}</td>
                <td>
                  {editingId !== s.id && (
                    <button
                      onClick={() => { setEditingId(s.id); setEditValue(String(s.ideal_stock)) }}
                      className="btn-secondary"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

// ── Bags tab ──────────────────────────────────────────────────────────────────
function BagsTab() {
  const [bagTypes, setBagTypes] = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [items, setItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    supabase.from('bag_types').select('*').order('name').then(({ data }) => {
      setBagTypes(data || [])
      if (data?.length) setSelectedType(data[0])
    })
  }, [])

  useEffect(() => {
    if (!selectedType) return
    supabase.from('bag_type_items').select('*').eq('bag_type_id', selectedType.id).order('item_name')
      .then(({ data }) => setItems(data || []))
  }, [selectedType])

  async function saveIdeal(id) {
    const val = parseInt(editValue, 10)
    if (isNaN(val) || val < 0) { setEditingId(null); return }
    await supabase.from('bag_type_items').update({ ideal_quantity: val }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, ideal_quantity: val } : i))
    setEditingId(null)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Modificar la cantidad ideal por ítem en cada tipo de morral.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {bagTypes.map(bt => (
          <button
            key={bt.id}
            onClick={() => setSelectedType(bt)}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: selectedType?.id === bt.id ? '#E8112D' : 'var(--surface)',
              color: selectedType?.id === bt.id ? 'white' : 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              transition: 'all 0.15s',
            }}
          >
            {bt.name}
          </button>
        ))}
      </div>
      {selectedType && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ítem</th>
                <th style={{ textAlign: 'right' }}>Cantidad ideal</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === item.id ? (
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                        style={{
                          width: 80,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--input-bg)',
                          color: 'var(--text)',
                          fontSize: 13,
                          textAlign: 'right',
                          outline: 'none',
                          fontFamily: 'var(--font-family)',
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveIdeal(item.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => saveIdeal(item.id)}
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{item.ideal_quantity}</span>
                    )}
                  </td>
                  <td>
                    {editingId !== item.id && (
                      <button
                        onClick={() => { setEditingId(item.id); setEditValue(String(item.ideal_quantity)) }}
                        className="btn-secondary"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Equipment tab ─────────────────────────────────────────────────────────────
function EquipmentTab() {
  const [form, setForm] = useState({ type: '', item_number: '', year_acquired: '', condition: 'good', notes: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [types, setTypes] = useState([])
  const [newType, setNewType] = useState('')

  useEffect(() => {
    supabase.from('equipment').select('type').then(({ data }) => {
      if (data) setTypes([...new Set(data.map(d => d.type))].sort())
    })
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.type.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('equipment').insert({
      type: form.type.trim(),
      item_number: form.item_number.trim() || null,
      year_acquired: form.year_acquired.trim() || null,
      condition: form.condition,
      notes: form.notes.trim() || null,
      has_id: !!form.item_number.trim(),
    })
    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setForm({ type: form.type, item_number: '', year_acquired: '', condition: 'good', notes: '' })
      setTimeout(() => setSuccess(false), 3000)
      if (!types.includes(form.type)) setTypes(t => [...t, form.type].sort())
    }
    setSaving(false)
  }

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'var(--font-family)',
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Agregar nuevos items de equipamiento. Para editar condición y observaciones usá la sección Equipamiento.
      </p>
      <form onSubmit={handleAdd} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo *</label>
            <input
              list="type-suggestions"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              required
              placeholder="ej. Morral"
              style={{ ...inputStyle, width: '100%' }}
            />
            <datalist id="type-suggestions">
              {types.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Número</label>
            <input value={form.item_number} onChange={e => setForm(f => ({ ...f, item_number: e.target.value }))} placeholder="S/N" style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Año</label>
            <input value={form.year_acquired} onChange={e => setForm(f => ({ ...f, year_acquired: e.target.value }))} placeholder="ej. 2026" style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Condición</label>
            <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
              <option value="good">Bueno</option>
              <option value="damaged">Dañado</option>
              <option value="unknown">Desconocido</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observaciones</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" style={{ ...inputStyle, width: '100%' }} />
        </div>
        {error && <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ padding: '8px 12px', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 6, color: '#16a34a', fontSize: 13, marginBottom: 12 }}>✓ Item agregado correctamente</div>}
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Agregar item'}</button>
      </form>
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', role: 'volunteer' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function fetchUsers() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (res.ok) setUsers(data)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  async function createUser(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al crear usuario')
    } else {
      setShowModal(false)
      setForm({ email: '', password: '', role: 'volunteer' })
      fetchUsers()
    }
    setSaving(false)
  }

  async function changeRole(userId, newRole) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId, role: newRole }),
    })
    fetchUsers()
  }

  async function disableUser(userId) {
    if (!confirm('¿Desactivar este usuario?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId }),
    })
    fetchUsers()
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'var(--font-family)',
    marginBottom: 12,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Gestión de usuarios del sistema.
        </p>
        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
          + Nuevo usuario
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cargando usuarios…</div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.email}</td>
                  <td>
                    <select
                      value={u.profile?.role || 'volunteer'}
                      onChange={e => changeRole(u.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      <option value="volunteer">Voluntario</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      color: u.banned_until ? '#ef4444' : '#16a34a',
                      background: u.banned_until ? 'rgba(239,68,68,0.1)' : 'rgba(22,163,74,0.1)',
                    }}>
                      {u.banned_until ? 'Inactivo' : 'Activo'}
                    </span>
                  </td>
                  <td>
                    {!u.banned_until && (
                      <button
                        onClick={() => disableUser(u.id)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          border: '1px solid rgba(239,68,68,0.3)',
                          background: 'transparent',
                          color: '#ef4444',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-family)',
                        }}
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
              Nuevo usuario
            </h3>
            <form onSubmit={createUser}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="usuario@email.com" />

              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contraseña temporal *</label>
              <input type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} placeholder="Mínimo 8 caracteres" />

              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rol</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="volunteer">Voluntario</option>
                <option value="admin">Admin</option>
              </select>

              {error && <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" disabled={saving}>Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creando…' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Parameters() {
  const [activeTab, setActiveTab] = useState('Insumos')

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
          Parámetros
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configuración del sistema — solo administradores</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px 8px 0 0',
              border: '1px solid transparent',
              borderBottom: 'none',
              background: activeTab === tab ? 'var(--surface)' : 'transparent',
              color: activeTab === tab ? '#E8112D' : 'var(--text-muted)',
              fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              marginBottom: activeTab === tab ? -1 : 0,
              borderColor: activeTab === tab ? 'var(--border)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Insumos' && <SuppliesTab />}
      {activeTab === 'Morrales' && <BagsTab />}
      {activeTab === 'Equipamiento' && <EquipmentTab />}
      {activeTab === 'Usuarios' && <UsersTab />}
    </div>
  )
}
