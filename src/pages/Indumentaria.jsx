import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase, withTimeout } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL']

// Keys match the exact CHECK constraint values stored in the DB
const CLOTHING_CONDITION = {
  'Bueno':      { label: 'Bueno',      color: '#16a34a', bg: 'rgba(22,163,74,0.1)',    border: 'rgba(22,163,74,0.25)' },
  'Desgastado': { label: 'Desgastado', color: '#ea580c', bg: 'rgba(234,88,12,0.1)',    border: 'rgba(234,88,12,0.25)' },
  'Descosido':  { label: 'Descosido',  color: '#ca8a04', bg: 'rgba(202,138,4,0.1)',    border: 'rgba(202,138,4,0.25)' },
  'Roto':       { label: 'Roto',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)' },
  'En falta':   { label: 'En falta',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
}

// Returns problem tags for a set of items (only non-good conditions that are present)
function problemTags(itemList) {
  const tags = []
  if (itemList.some(i => i.condition === 'En falta'))   tags.push('Tiene en falta')
  if (itemList.some(i => i.condition === 'Roto'))       tags.push('Tiene rotos')
  if (itemList.some(i => i.condition === 'Desgastado')) tags.push('Tiene desgastados')
  if (itemList.some(i => i.condition === 'Descosido'))  tags.push('Tiene descosidos')
  return tags
}

function ConditionBadge({ condition }) {
  const m = CLOTHING_CONDITION[condition] || { label: condition || '—', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: m.color, background: m.bg, border: `1px solid ${m.border}`, display: 'inline-block' }}>
      {m.label}
    </span>
  )
}

function sortedSizes(sizeSet) {
  const inOrder = SIZE_ORDER.filter(s => sizeSet.has(s))
  const others = [...sizeSet].filter(s => !SIZE_ORDER.includes(s)).sort()
  return [...inOrder, ...others]
}

// ── Prendas ───────────────────────────────────────────────────────────────────
function PrendasSection({ canEdit, isAdmin, user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({ condition: 'Bueno', notes: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbErr } = await withTimeout(
        supabase.from('clothing').select('*').order('type').order('item_number', { nullsFirst: true })
      )
      if (dbErr) throw new Error(dbErr.message)
      setItems(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function startEdit(item) {
    setEditingId(item.id)
    setEditValues({ condition: item.condition || 'Bueno', notes: item.notes || '' })
  }

  async function saveEdit(id) {
    const original = items.find(i => i.id === id)
    const { error: err } = await supabase
      .from('clothing')
      .update({ condition: editValues.condition, notes: editValues.notes || null })
      .eq('id', id)
    if (!err) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, condition: editValues.condition, notes: editValues.notes } : i))
      if (user && original) {
        const parts = []
        // condition keys are the DB values themselves, no label mapping needed
        if (editValues.condition !== original.condition)
          parts.push(`estado ${original.condition} → ${editValues.condition}`)
        if (editValues.notes !== (original.notes || ''))
          parts.push(`observación → '${editValues.notes}'`)
        if (parts.length > 0) {
          const label = `${original.type} ${original.size}${original.item_number ? ' #' + original.item_number : ''}`
          const { error: logErr } = await supabase.from('activity_log').insert({
            user_id: user.id, action_type: 'manual_update',
            description: `[indumentaria] ${label}: ${parts.join(' | ')}`,
          })
          if (logErr) console.error('[activity_log] insert failed:', logErr)
        }
      }
    }
    setEditingId(null)
  }

  async function deleteItem(item) {
    const label = `${item.type} ${item.size}${item.item_number ? ' #' + item.item_number : ''}`
    if (!window.confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`)) return
    const { error: err } = await supabase.from('clothing').delete().eq('id', item.id)
    if (!err) {
      setItems(prev => prev.filter(i => i.id !== item.id))
      if (user) {
        const { error: logErr } = await supabase.from('activity_log').insert({
          user_id: user.id, action_type: 'manual_update',
          description: `[indumentaria] Prenda eliminada: ${label}`,
        })
        if (logErr) console.error('[activity_log] insert failed:', logErr)
      }
    }
  }

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>Cargando prendas…</div>
  if (error) return (
    <div>
      <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>
      <button onClick={fetchData} className="btn-secondary" style={{ fontSize: 13 }}>↺ Reintentar</button>
    </div>
  )
  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
      No hay prendas registradas.
    </div>
  )

  // Group: type → size → items[]
  const byType = {}
  for (const item of items) {
    if (!byType[item.type]) byType[item.type] = {}
    if (!byType[item.type][item.size]) byType[item.type][item.size] = []
    byType[item.type][item.size].push(item)
  }

  // Page-level summary counts
  const typeCount    = Object.keys(byType).length
  const missingCount = items.filter(i => i.condition === 'missing').length
  const brokenCount  = items.filter(i => i.condition === 'broken').length
  const wornCount    = items.filter(i => i.condition === 'worn').length
  const tornCount    = items.filter(i => i.condition === 'torn').length
  const pageProblemParts = []
  if (missingCount > 0) pageProblemParts.push(`${missingCount} en falta`)
  if (brokenCount > 0)  pageProblemParts.push(`${brokenCount} rota${brokenCount !== 1 ? 's' : ''}`)
  if (wornCount > 0)    pageProblemParts.push(`${wornCount} desgastada${wornCount !== 1 ? 's' : ''}`)
  if (tornCount > 0)    pageProblemParts.push(`${tornCount} descosida${tornCount !== 1 ? 's' : ''}`)

  const selectSt = {
    padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12,
    cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-family)',
  }
  const inputSt = {
    padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12,
    outline: 'none', fontFamily: 'var(--font-family)', width: '100%', minWidth: 150,
  }
  const deleteSt = {
    padding: '4px 10px', fontSize: 12, borderRadius: 6,
    border: '1px solid rgba(239,68,68,0.35)', background: 'transparent',
    color: '#ef4444', cursor: 'pointer', fontFamily: 'var(--font-family)',
  }

  return (
    <div>
      {/* Page-level summary */}
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        {items.length} prenda{items.length !== 1 ? 's' : ''} · {typeCount} tipo{typeCount !== 1 ? 's' : ''}
        {pageProblemParts.length > 0 && (
          <span style={{ marginLeft: 10, color: '#d97706', fontWeight: 600 }}>
            ⚠ {pageProblemParts.join(' · ')}
          </span>
        )}
      </p>

      {Object.entries(byType).map(([type, bySize]) => {
        const typeItems = Object.values(bySize).flat()
        const total = typeItems.length
        const sizes = sortedSizes(new Set(Object.keys(bySize)))
        const typeProblems = problemTags(typeItems)

        return (
          <div key={type} style={{ marginBottom: 32 }}>
            {/* Type header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid var(--border)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>{type}</h2>
              <span style={{ padding: '2px 10px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                {total}
              </span>
              {typeProblems.length > 0 && (
                <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                  ⚠ {typeProblems.join(' · ')}
                </span>
              )}
            </div>

            {/* Size groups */}
            {sizes.map(size => {
              const sizeItems = bySize[size]
              const sizeProblems = problemTags(sizeItems)
              return (
                <div key={size} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.2px' }}>
                      {size} ({sizeItems.length})
                    </span>
                    {sizeProblems.length > 0 && (
                      <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                        ⚠ {sizeProblems.join(' · ')}
                      </span>
                    )}
                  </div>
                  <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Nro</th>
                            <th>Año</th>
                            <th>Estado</th>
                            <th>Observación</th>
                            {(canEdit || isAdmin) && <th>Acción</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sizeItems.map(item => (
                            <tr key={item.id}>
                              <td>
                                <span style={{ fontWeight: item.item_number ? 600 : 400, color: item.item_number ? 'var(--text)' : 'var(--text-muted)' }}>
                                  {item.item_number || 'S/N'}
                                </span>
                              </td>
                              <td style={{ color: item.year_acquired ? 'var(--text)' : 'var(--text-muted)' }}>
                                {item.year_acquired || '—'}
                              </td>
                              <td>
                                {editingId === item.id ? (
                                  <select
                                    value={editValues.condition}
                                    onChange={e => setEditValues(v => ({ ...v, condition: e.target.value }))}
                                    style={selectSt}
                                  >
                                    {Object.entries(CLOTHING_CONDITION).map(([k, v]) => (
                                      <option key={k} value={k}>{v.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <ConditionBadge condition={item.condition} />
                                )}
                              </td>
                              <td>
                                {editingId === item.id ? (
                                  <input
                                    value={editValues.notes}
                                    onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                                    placeholder="Sin observaciones"
                                    style={inputSt}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveEdit(item.id)
                                      if (e.key === 'Escape') setEditingId(null)
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: item.notes ? 'var(--text)' : 'var(--text-muted)', fontSize: 13 }}>
                                    {item.notes || '—'}
                                  </span>
                                )}
                              </td>
                              {(canEdit || isAdmin) && (
                                <td>
                                  {editingId === item.id ? (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button onClick={() => saveEdit(item.id)} className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>Guardar</button>
                                      <button onClick={() => setEditingId(null)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>Cancelar</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button onClick={() => startEdit(item)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>Editar</button>
                                      {isAdmin && (
                                        <button onClick={() => deleteItem(item)} style={deleteSt}>Eliminar</button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Accesorios ────────────────────────────────────────────────────────────────
function AccesoriosSection({ canEdit, isAdmin, user }) {
  const [accessories, setAccessories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null) // current_stock edit
  const [editValue, setEditValue] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbErr } = await withTimeout(
        supabase.from('accessories').select('*').order('name')
      )
      if (dbErr) throw new Error(dbErr.message)
      setAccessories(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveCurrentStock(id) {
    const val = parseInt(editValue, 10)
    if (isNaN(val) || val < 0) { setEditingId(null); return }
    const acc = accessories.find(a => a.id === id)
    const prev = acc?.current_stock
    const { error: err } = await supabase.from('accessories').update({ current_stock: val }).eq('id', id)
    if (!err) {
      setAccessories(prev => prev.map(a => a.id === id ? { ...a, current_stock: val } : a))
      if (user && acc) {
        const { error: logErr } = await supabase.from('activity_log').insert({
          user_id: user.id, action_type: 'manual_update',
          description: `[indumentaria] ${acc.name}: ${prev} → ${val}`,
        })
        if (logErr) console.error('[activity_log] insert failed:', logErr)
      }
    }
    setEditingId(null)
  }

  async function deleteAccessory(acc) {
    if (!window.confirm(`¿Eliminar "${acc.name}"? Esta acción no se puede deshacer.`)) return
    const { error: err } = await supabase.from('accessories').delete().eq('id', acc.id)
    if (!err) {
      setAccessories(prev => prev.filter(a => a.id !== acc.id))
      if (user) {
        const { error: logErr } = await supabase.from('activity_log').insert({
          user_id: user.id, action_type: 'manual_update',
          description: `[indumentaria] Accesorio eliminado: ${acc.name}`,
        })
        if (logErr) console.error('[activity_log] insert failed:', logErr)
      }
    }
  }

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>Cargando accesorios…</div>
  if (error) return (
    <div>
      <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>
      <button onClick={fetchData} className="btn-secondary" style={{ fontSize: 13 }}>↺ Reintentar</button>
    </div>
  )
  if (accessories.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
      No hay accesorios registrados.
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {accessories.map(acc => {
        const faltante = Math.max(0, (acc.registered_stock || 0) - (acc.current_stock || 0))
        const pctFaltante = (acc.registered_stock || 0) > 0 ? faltante / acc.registered_stock : 0
        const status = faltante === 0 ? 'ok' : pctFaltante <= 0.30 ? 'warn' : 'critical'
        const palette = {
          ok:       { border: 'rgba(22,163,74,0.3)',  bg: 'rgba(22,163,74,0.05)',  accent: '#16a34a' },
          warn:     { border: 'rgba(217,119,6,0.3)',  bg: 'rgba(217,119,6,0.05)',  accent: '#d97706' },
          critical: { border: 'rgba(239,68,68,0.3)',  bg: 'rgba(239,68,68,0.05)',  accent: '#ef4444' },
        }[status]

        return (
          <div key={acc.id} style={{
            background: 'var(--surface)',
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Card header */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${palette.border}`, background: palette.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{acc.name}</span>
              {isAdmin && (
                <button
                  onClick={() => deleteAccessory(acc)}
                  style={{ padding: '3px 8px', fontSize: 11, borderRadius: 5, border: '1px solid rgba(239,68,68,0.35)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontFamily: 'var(--font-family)', marginLeft: 8, flexShrink: 0 }}
                >
                  Eliminar
                </button>
              )}
            </div>

            {/* Stats */}
            <div style={{ padding: '10px 16px', flex: 1 }}>
              {/* Registered stock — read-only; editable only from Parámetros */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cantidad registrada</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{acc.registered_stock ?? '—'}</span>
              </div>

              {/* Current stock */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cantidad actual</span>
                {(canEdit || isAdmin) && editingId === acc.id ? (
                  <input
                    type="number" min="0" value={editValue} autoFocus
                    onChange={e => setEditValue(e.target.value)}
                    style={{ width: 70, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, textAlign: 'center', outline: 'none', fontFamily: 'var(--font-family)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCurrentStock(acc.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => saveCurrentStock(acc.id)}
                  />
                ) : (
                  <span
                    title={canEdit || isAdmin ? 'Clic para editar' : ''}
                    onClick={() => { if (canEdit || isAdmin) { setEditingId(acc.id); setEditValue(String(acc.current_stock ?? 0)) } }}
                    style={{
                      fontWeight: 700, fontSize: 14,
                      color: faltante > 0 ? palette.accent : '#16a34a',
                      cursor: (canEdit || isAdmin) ? 'pointer' : 'default',
                      padding: '2px 6px', borderRadius: 4,
                    }}
                  >
                    {acc.current_stock ?? 0}
                  </span>
                )}
              </div>

              {/* Faltante */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Faltante</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: faltante > 0 ? palette.accent : '#16a34a' }}>
                  {faltante > 0 ? `-${faltante}` : '✓'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Export helper ─────────────────────────────────────────────────────────────
function buildSheet(headers, data) {
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ...data.map(row => headers.map(h => row[h] ?? '')),
  ])
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.max(h.length, ...data.map(row => String(row[h] ?? '').length)) + 2,
  }))
  return ws
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Indumentaria() {
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const canEdit = isAdmin || profile?.role === 'volunteer'
  const [activeTab, setActiveTab] = useState('Prendas')
  const [exportLoading, setExportLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  async function handleExport() {
    setExportLoading(true)
    try {
      const [clothingRes, accRes] = await Promise.all([
        supabase.from('clothing').select('*').order('type').order('size').order('item_number', { nullsFirst: true }),
        supabase.from('accessories').select('*').order('name'),
      ])
      const clothing = clothingRes.data || []
      const accessories = accRes.data || []
      const condLabel = c => CLOTHING_CONDITION[c]?.label ?? c ?? '—'

      const prendaHeaders = ['Tipo', 'Talle', 'Nro', 'Año', 'Estado', 'Observación']
      const prendaData = clothing.map(c => ({
        'Tipo': c.type,
        'Talle': c.size,
        'Nro': c.item_number || 'S/N',
        'Año': c.year_acquired || '—',
        'Estado': condLabel(c.condition),
        'Observación': c.notes || '—',
      }))

      const accHeaders = ['Accesorio', 'Cantidad registrada', 'Cantidad actual', 'Faltante']
      const accData = accessories.map(a => ({
        'Accesorio': a.name,
        'Cantidad registrada': a.registered_stock ?? 0,
        'Cantidad actual': a.current_stock ?? 0,
        'Faltante': Math.max(0, (a.registered_stock ?? 0) - (a.current_stock ?? 0)),
      }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, buildSheet(prendaHeaders, prendaData), 'Prendas')
      XLSX.utils.book_append_sheet(wb, buildSheet(accHeaders, accData), 'Accesorios')
      XLSX.writeFile(wb, `inventario_cruzroja_indumentaria_${today}.xlsx`)
    } catch (err) {
      console.error('Export error:', err)
      alert('Error al exportar: ' + err.message)
    } finally {
      setExportLoading(false)
    }
  }

  const SUBTABS = ['Prendas', 'Accesorios']

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
            Indumentaria
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Prendas y accesorios del personal</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleExport}
            disabled={exportLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)', fontSize: 13, fontWeight: 500,
              cursor: exportLoading ? 'not-allowed' : 'pointer',
              opacity: exportLoading ? 0.7 : 1,
              fontFamily: 'var(--font-family)',
              transition: 'background 0.15s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exportLoading ? 'Exportando…' : 'Exportar Excel'}
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {SUBTABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0',
              border: '1px solid transparent', borderBottom: 'none',
              background: activeTab === tab ? 'var(--surface)' : 'transparent',
              color: activeTab === tab ? '#E8112D' : 'var(--text-muted)',
              fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-family)',
              marginBottom: activeTab === tab ? -1 : 0,
              borderColor: activeTab === tab ? 'var(--border)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Prendas' && (
        <PrendasSection canEdit={canEdit} isAdmin={isAdmin} user={user} />
      )}
      {activeTab === 'Accesorios' && (
        <AccesoriosSection canEdit={canEdit} isAdmin={isAdmin} user={user} />
      )}
    </div>
  )
}
