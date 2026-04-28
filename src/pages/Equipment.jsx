import { useState, useEffect, useCallback } from 'react'
import { supabase, withTimeout } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import AIInput from '../components/AIInput'
import ExportButton from '../components/ExportButton'

const CONDITION_META = {
  good:    { label: 'Bueno',       color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.25)' },
  damaged: { label: 'Dañado',      color: '#d97706', bg: 'rgba(217,119,6,0.1)',   border: 'rgba(217,119,6,0.25)' },
  unknown: { label: 'Desconocido', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
}

function ConditionBadge({ condition }) {
  const m = CONDITION_META[condition] || CONDITION_META.unknown
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      color: m.color,
      background: m.bg,
      border: `1px solid ${m.border}`,
      display: 'inline-block',
    }}>
      {m.label}
    </span>
  )
}

export default function Equipment() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [filterCondition, setFilterCondition] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbErr } = await withTimeout(
        supabase.from('equipment').select('*').order('type').order('item_number', { nullsFirst: true }),
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

  const allTypes = [...new Set(items.map(i => i.type))].sort()

  const filtered = items.filter(item => {
    if (filterType && item.type !== filterType) return false
    if (filterCondition && item.condition !== filterCondition) return false
    return true
  })

  const grouped = filtered.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || []
    acc[item.type].push(item)
    return acc
  }, {})

  function startEdit(item) {
    setEditingId(item.id)
    setEditValues({ condition: item.condition, notes: item.notes || '' })
  }

  async function saveEdit(id) {
    const { error } = await supabase
      .from('equipment')
      .update({ ...editValues, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...editValues } : i))
    }
    setEditingId(null)
  }

  const exportData = items.map(i => ({
    Tipo: i.type,
    'Número': i.item_number || 'S/N',
    'Año': i.year_acquired || '-',
    'Condición': CONDITION_META[i.condition]?.label || i.condition,
    'Observaciones': i.notes || '-',
  }))

  const today = new Date().toISOString().split('T')[0]

  const selectStyle = {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'var(--font-family)',
  }

  const inputStyle = {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'var(--font-family)',
    width: '100%',
    minWidth: 180,
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Cargando equipamiento…</div>
  if (error) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>
      <button onClick={fetchData} className="btn-secondary" style={{ fontSize: 13 }}>↺ Reintentar conexión</button>
    </div>
  )

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
            Equipamiento
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {items.length} items · {allTypes.length} tipos
            {items.filter(i => i.condition === 'damaged').length > 0 && (
              <span style={{ marginLeft: 10, color: '#d97706', fontWeight: 600 }}>
                ⚠ {items.filter(i => i.condition === 'damaged').length} dañados
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <ExportButton
            data={exportData}
            headers={['Tipo', 'Número', 'Año', 'Condición', 'Observaciones']}
            filename={`inventario_cruzroja_equipamiento_${today}.xlsx`}
          />
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="">Todos los tipos</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterCondition} onChange={e => setFilterCondition(e.target.value)} style={selectStyle}>
          <option value="">Todas las condiciones</option>
          <option value="good">Bueno</option>
          <option value="damaged">Dañado</option>
          <option value="unknown">Desconocido</option>
        </select>
        {(filterType || filterCondition) && (
          <button
            onClick={() => { setFilterType(''); setFilterCondition('') }}
            style={{ ...selectStyle, color: '#E8112D', borderColor: 'rgba(232,17,45,0.3)' }}
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          No se encontraron items con los filtros seleccionados.
        </div>
      )}

      {/* Grouped tables */}
      {Object.entries(grouped).map(([type, typeItems]) => (
        <div key={type} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              {type}
            </h2>
            <span style={{
              padding: '2px 8px',
              borderRadius: 20,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              {typeItems.length}
            </span>
            {typeItems.some(i => i.condition === 'damaged') && (
              <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>⚠ Tiene dañados</span>
            )}
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nro</th>
                  <th>Año</th>
                  <th>Condición</th>
                  <th>Observaciones</th>
                  {isAdmin && <th>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {typeItems.map(item => (
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
                          style={{ ...selectStyle, fontSize: 12 }}
                        >
                          <option value="good">Bueno</option>
                          <option value="damaged">Dañado</option>
                          <option value="unknown">Desconocido</option>
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
                          style={inputStyle}
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
                    {isAdmin && (
                      <td>
                        {editingId === item.id ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => saveEdit(item.id)}
                              className="btn-primary"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="btn-secondary"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item)}
                            className="btn-secondary"
                            style={{ padding: '5px 12px', fontSize: 12 }}
                          >
                            Editar
                          </button>
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
      ))}

      {isAdmin && (
        <div style={{ marginTop: 16 }}>
          <AIInput section="equipment" onChangesApplied={fetchData} />
        </div>
      )}
    </div>
  )
}
