import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import AIInput from '../components/AIInput'
import ExportButton from '../components/ExportButton'

function completeness(contents) {
  if (!contents || contents.length === 0) return 0
  const ideal = contents.reduce((s, c) => s + c.ideal_quantity, 0)
  const actual = contents.reduce((s, c) => s + c.current_quantity, 0)
  if (ideal === 0) return 100
  return Math.min(100, Math.round((actual / ideal) * 100))
}

function pctColor(p) {
  if (p >= 90) return '#16a34a'
  if (p >= 50) return '#d97706'
  return '#ef4444'
}

function BagCard({ bag, isAdmin, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)

  const pct = completeness(bag.bag_contents)
  const color = pctColor(pct)

  const missingItems = (bag.bag_contents || []).filter(
    c => c.current_quantity < c.ideal_quantity
  )

  function startEdit() {
    const map = {}
    bag.bag_contents?.forEach(c => { map[c.id] = c.current_quantity })
    setValues(map)
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    const updates = Object.entries(values).map(([id, qty]) =>
      supabase.from('bag_contents').update({ current_quantity: parseInt(qty, 10) || 0 }).eq('id', parseInt(id, 10))
    )
    await Promise.all(updates)

    const newPct = completeness(
      bag.bag_contents?.map(c => ({ ...c, current_quantity: parseInt(values[c.id], 10) || 0 }))
    )
    const newCondition = newPct >= 100 ? 'complete' : newPct > 0 ? 'incomplete' : 'damaged'
    await supabase.from('bags').update({ condition: newCondition, updated_at: new Date().toISOString() }).eq('id', bag.id)

    setSaving(false)
    setEditing(false)
    onUpdate?.()
  }

  const conditionMeta = {
    complete:   { label: 'Completo',   color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    incomplete: { label: 'Incompleto', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    damaged:    { label: 'Dañado',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
  const cm = conditionMeta[bag.condition] || conditionMeta.incomplete

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Card header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: pct < 90 ? `rgba(${pct < 50 ? '239,68,68' : '217,119,6'},0.04)` : 'transparent',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Morral #{bag.bag_number}
            </span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: cm.bg, color: cm.color, fontWeight: 600 }}>
              {cm.label}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {bag.bag_type?.name || 'Morral estándar'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>completo</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>

      {/* Items list */}
      <div style={{ padding: '12px 18px', flex: 1, overflow: 'auto', maxHeight: 280 }}>
        {missingItems.length === 0 && !editing && (
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 500, padding: '4px 0' }}>
            ✓ Todo completo
          </div>
        )}
        {(editing ? bag.bag_contents || [] : missingItems).map(item => (
          <div key={item.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
            borderBottom: '1px solid var(--border)',
            gap: 10,
          }}>
            <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{item.item_name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {editing ? (
                <input
                  type="number"
                  min="0"
                  value={values[item.id] ?? item.current_quantity}
                  onChange={e => setValues(v => ({ ...v, [item.id]: e.target.value }))}
                  style={{
                    width: 60,
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    textAlign: 'center',
                    outline: 'none',
                    fontFamily: 'var(--font-family)',
                  }}
                />
              ) : (
                <span style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: item.current_quantity < item.ideal_quantity ? '#ef4444' : '#16a34a',
                }}>
                  {item.current_quantity}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {item.ideal_quantity}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Card footer */}
      {isAdmin && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={saving}>
                Cancelar
              </button>
              <button onClick={saveEdit} className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          ) : (
            <button onClick={startEdit} className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }}>
              Editar cantidades
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Bags() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [bags, setBags] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bags')
      .select('*, bag_type:bag_types(name), bag_contents(*)')
      .order('bag_number')
    if (!error) setBags(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const complete = bags.filter(b => completeness(b.bag_contents) >= 100).length
  const incomplete = bags.filter(b => completeness(b.bag_contents) < 100).length

  const exportData = bags.map(b => {
    const pct = completeness(b.bag_contents)
    const totalIdeal = b.bag_contents?.reduce((s, c) => s + c.ideal_quantity, 0) || 0
    const totalActual = b.bag_contents?.reduce((s, c) => s + c.current_quantity, 0) || 0
    return {
      'Morral': b.bag_number,
      'Tipo': b.bag_type?.name || '—',
      'Condición': b.condition,
      'Completitud %': pct + '%',
      'Ítems ideal': totalIdeal,
      'Ítems actual': totalActual,
      'Notas': b.notes || '—',
    }
  })

  const today = new Date().toISOString().split('T')[0]

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Cargando morrales…</div>
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
            Morrales
          </h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{complete}</span>
              <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>completos</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{incomplete}</span>
              <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>incompletos</span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <ExportButton
            data={exportData}
            headers={['Morral', 'Tipo', 'Condición', 'Completitud %', 'Ítems ideal', 'Ítems actual', 'Notas']}
            filename={`inventario_cruzroja_morrales_${today}.csv`}
          />
        )}
      </div>

      {/* Grid of cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16,
        marginBottom: 28,
      }}>
        {bags.map(bag => (
          <BagCard key={bag.id} bag={bag} isAdmin={isAdmin} onUpdate={fetchData} />
        ))}
      </div>

      {bags.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          No hay morrales registrados.
        </div>
      )}

      {isAdmin && (
        <AIInput section="bags" onChangesApplied={fetchData} />
      )}
    </div>
  )
}
